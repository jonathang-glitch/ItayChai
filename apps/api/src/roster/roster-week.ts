import { ConflictException, NotFoundException } from '@nestjs/common';
import { jerusalemDayKey, jerusalemWeekday } from '@itay-chai/contracts';
import { enqueueWhatsAppSendNow, prisma, withTenantDb } from '@itay-chai/database';
import {
  buildWeekSlots,
  claimRefusal,
  readSchedule,
  resolveShiftPicks,
  slotLabel,
  slotTalk,
  upcomingHolidays,
  weekAskText,
  type ShopSchedule,
  type WeekSlot,
} from '@itay-chai/domain';
import { pickUrl } from './pick-link';
import { readStore, sameInstant, weekShifts, writeConfig } from './roster-store';
import { ownerStore } from './roster.shared';

async function loadStore() {
  const { tenantId, storeId } = await ownerStore();
  return readStore(tenantId, storeId);
}

export async function getWeekPlan() {
  const { tenantId, storeId, schedule, slots } = await loadStore();
  const shifts = await weekShifts(tenantId, storeId, slots);
  const workers = await prisma.employee.findMany({
    where: { tenantId, businessUnitId: storeId, userId: { not: null } },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
  });
  const holidays = upcomingHolidays(new Date(), 400).map((holiday) => ({
    ...holiday,
    closed: !schedule.skippedHolidays.includes(holiday.date),
  }));
  const board = slots.map((slot) => ({
    ...slot,
    needed: schedule.needed,
    people: shifts
      .filter((shift) => sameInstant(shift.startsAt, slot.startsAt))
      .map((shift) => ({
        shiftId: shift.id,
        employeeId: shift.employeeId,
        name: shift.employee.displayName,
      })),
  }));
  const gaps = workers.map((worker) => {
    const mine = shifts.filter((shift) => shift.employeeId === worker.id);
    const weekend = mine.filter((shift) => jerusalemWeekday(shift.startsAt) >= 5).length;
    return {
      employeeId: worker.id,
      name: worker.displayName,
      shifts: mine.length,
      weekend,
      short: schedule.minShifts > 0 && mine.length < schedule.minShifts,
      weekendShort: schedule.minWeekend > 0 && weekend < schedule.minWeekend,
    };
  });
  return { schedule, holidays, slots: board, gaps, workers };
}

export async function saveSchedule(input: unknown) {
  const { tenantId, storeId, config } = await loadStore();
  const schedule = readSchedule(input);
  if (schedule.closesAt <= schedule.opensAt) {
    throw new ConflictException('Close must be after open');
  }
  await writeConfig(tenantId, storeId, config, { schedule });
  return getWeekPlan();
}

export async function buildWeek() {
  const { tenantId, storeId, config, schedule } = await loadStore();
  const slots = buildWeekSlots(schedule);
  await writeConfig(tenantId, storeId, config, { schedule, slots });
  return getWeekPlan();
}

export async function assignSlot(employeeId: string, slotId: string) {
  const { tenantId, storeId, schedule, slots } = await loadStore();
  const slot = slots.find((row) => row.id === slotId);
  if (!slot) {
    throw new NotFoundException('Shift not found');
  }
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId, businessUnitId: storeId },
    select: { id: true },
  });
  if (!employee) {
    throw new NotFoundException('Worker not found');
  }
  const shifts = await weekShifts(tenantId, storeId, slots);
  const day = jerusalemDayKey(slot.startsAt);
  const mine = shifts.filter((shift) => shift.employeeId === employee.id);
  const refusal = claimRefusal({
    schedule,
    startsAt: slot.startsAt,
    alreadyThatDay: mine.some((shift) => jerusalemDayKey(shift.startsAt) === day),
    shiftCount: mine.length,
    weekendCount: mine.filter((shift) => jerusalemWeekday(shift.startsAt) >= 5).length,
    filled: shifts.filter((shift) => sameInstant(shift.startsAt, slot.startsAt)).length,
  });
  if (refusal) {
    throw new ConflictException(refusal);
  }
  await withTenantDb(tenantId, (tx) =>
    tx.shift.create({
      data: {
        tenantId,
        businessUnitId: storeId,
        employeeId: employee.id,
        label: slotLabel(slot),
        startsAt: new Date(slot.startsAt),
        endsAt: new Date(slot.endsAt),
      },
    }),
  );
  return getWeekPlan();
}

async function openSlots(
  tenantId: string,
  storeId: string,
  schedule: ShopSchedule,
  slots: WeekSlot[],
) {
  const shifts = await weekShifts(tenantId, storeId, slots);
  return slots
    .map((slot) => ({
      slot,
      left:
        schedule.needed -
        shifts.filter((shift) => sameInstant(shift.startsAt, slot.startsAt)).length,
    }))
    .filter((row) => row.left > 0);
}

export async function askTeam() {
  const { tenantId, storeId, shopName, schedule, slots } = await loadStore();
  const open = await openSlots(tenantId, storeId, schedule, slots);
  const workers = await prisma.employee.findMany({
    where: { tenantId, businessUnitId: storeId, userId: { not: null } },
    select: { id: true, userId: true, displayName: true },
  });
  let queued = 0;
  let skipped = 0;
  for (const worker of workers) {
    if (!worker.userId) {
      skipped += 1;
      continue;
    }
    const eventId = await enqueueWhatsAppSendNow({
      tenantId,
      userId: worker.userId,
      body: weekAskText({
        slots: open,
        name: worker.displayName,
        shopName,
        link: pickUrl(tenantId, worker.id),
      }),
      aggregateType: 'ShiftWeek',
      aggregateId: storeId,
    });
    if (eventId) {
      queued += 1;
    } else {
      skipped += 1;
    }
  }
  return { sent: queued, queued, skipped };
}

export async function claimWeekReply(tenantId: string, userId: string, text: string) {
  const unit = await prisma.employee.findFirst({
    where: { tenantId, userId },
    select: { id: true, businessUnitId: true },
  });
  if (!unit) {
    return null;
  }
  const { schedule, slots } = await readStore(tenantId, unit.businessUnitId);
  if (!slots.length) {
    return null;
  }
  const open = await openSlots(tenantId, unit.businessUnitId, schedule, slots);
  const picks = resolveShiftPicks(
    text,
    slots,
    open.map((row) => row.slot),
  );
  if (!picks.length) {
    return null;
  }
  const notes: string[] = [];
  for (const slotId of picks) {
    try {
      await assignSlotFor(tenantId, unit.businessUnitId, unit.id, slotId, schedule, slots);
      const taken = slots.find((row) => row.id === slotId);
      notes.push(taken ? `שובצת למשמרת: ${slotTalk(taken)}` : 'שובצת למשמרת.');
    } catch (error) {
      notes.push(error instanceof ConflictException ? String(error.message) : 'לא נרשמה המשמרת.');
    }
  }
  await enqueueWhatsAppSendNow({
    tenantId,
    userId,
    body: notes.join('\n'),
    aggregateType: 'ShiftWeek',
    aggregateId: unit.id,
  });
  return { ok: true as const, handled: 'roster' as const };
}

async function assignSlotFor(
  tenantId: string,
  storeId: string,
  employeeId: string,
  slotId: string,
  schedule: ShopSchedule,
  slots: WeekSlot[],
) {
  const slot = slots.find((row) => row.id === slotId);
  if (!slot) {
    throw new ConflictException('המשמרת לא נמצאה.');
  }
  const shifts = await weekShifts(tenantId, storeId, slots);
  const day = jerusalemDayKey(slot.startsAt);
  const mine = shifts.filter((shift) => shift.employeeId === employeeId);
  const refusal = claimRefusal({
    schedule,
    startsAt: slot.startsAt,
    alreadyThatDay: mine.some((shift) => jerusalemDayKey(shift.startsAt) === day),
    shiftCount: mine.length,
    weekendCount: mine.filter((shift) => jerusalemWeekday(shift.startsAt) >= 5).length,
    filled: shifts.filter((shift) => sameInstant(shift.startsAt, slot.startsAt)).length,
  });
  if (refusal) {
    throw new ConflictException(refusal);
  }
  await withTenantDb(tenantId, (tx) =>
    tx.shift.create({
      data: {
        tenantId,
        businessUnitId: storeId,
        employeeId,
        label: slotLabel(slot),
        startsAt: new Date(slot.startsAt),
        endsAt: new Date(slot.endsAt),
      },
    }),
  );
}
