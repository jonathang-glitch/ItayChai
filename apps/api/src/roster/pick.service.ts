import { ConflictException, NotFoundException } from '@nestjs/common';
import { jerusalemDayKey } from '@itay-chai/contracts';
import { prisma, withTenantDb } from '@itay-chai/database';
import { pickRefusal, pickRules, slotLabel } from '@itay-chai/domain';
import { readPickToken } from './pick-link';
import { removeShiftIn } from './roster-shifts';
import { readStore, sameInstant, weekShifts } from './roster-store';

async function loadPick(token: string) {
  const link = readPickToken(token);
  const employee = link
    ? await prisma.employee.findFirst({
        where: { id: link.employeeId, tenantId: link.tenantId },
        select: { id: true, displayName: true, businessUnitId: true },
      })
    : null;
  if (!link || !employee) {
    throw new NotFoundException('הקישור לא תקף. בקשו קישור חדש מהעסק.');
  }
  const store = await readStore(link.tenantId, employee.businessUnitId);
  const shifts = await weekShifts(link.tenantId, employee.businessUnitId, store.slots);
  const mine = shifts.filter((shift) => shift.employeeId === employee.id);
  const now = Date.now();
  const slots = store.slots.map((slot) => {
    const here = shifts.filter((shift) => sameInstant(shift.startsAt, slot.startsAt));
    return {
      ...slot,
      takenByOthers: here.filter((shift) => shift.employeeId !== employee.id).length,
      mineShiftId: here.find((shift) => shift.employeeId === employee.id)?.id ?? null,
      past: new Date(slot.startsAt).getTime() <= now,
    };
  });
  const busyDays = mine
    .filter((shift) => !store.slots.some((slot) => sameInstant(shift.startsAt, slot.startsAt)))
    .map((shift) => jerusalemDayKey(shift.startsAt));
  return { tenantId: link.tenantId, employee, store, slots, busyDays };
}

function view(page: Awaited<ReturnType<typeof loadPick>>) {
  return {
    shopName: page.store.shopName,
    workerName: page.employee.displayName,
    schedule: page.store.schedule,
    rules: pickRules(page.store.schedule),
    busyDays: page.busyDays,
    slots: page.slots.map(({ mineShiftId, ...slot }) => ({ ...slot, mine: Boolean(mineShiftId) })),
  };
}

export async function getPickPage(token: string) {
  return view(await loadPick(token));
}

export async function savePicks(token: string, slotIds: string[]) {
  const page = await loadPick(token);
  const wanted = new Set(slotIds);
  const final = page.slots.filter((slot) =>
    slot.past ? Boolean(slot.mineShiftId) : wanted.has(slot.id),
  );
  const refusal = pickRefusal({
    schedule: page.store.schedule,
    slots: page.slots.filter((slot) => !slot.past || slot.mineShiftId),
    picks: final.map((slot) => slot.id),
    busyDays: page.busyDays,
  });
  if (refusal) {
    throw new ConflictException(refusal);
  }
  const { tenantId, employee } = page;
  await withTenantDb(tenantId, async (tx) => {
    for (const slot of page.slots) {
      if (slot.mineShiftId && !slot.past && !wanted.has(slot.id)) {
        await removeShiftIn(
          tx,
          tenantId,
          slot.mineShiftId,
          `ה${slot.part} נמצאת בבקשת החלפה פתוחה, ואי אפשר להוריד אותה כאן.`,
        );
      }
    }
    for (const slot of final) {
      if (!slot.mineShiftId) {
        await tx.shift.create({
          data: {
            tenantId,
            businessUnitId: employee.businessUnitId,
            employeeId: employee.id,
            label: slotLabel(slot),
            startsAt: new Date(slot.startsAt),
            endsAt: new Date(slot.endsAt),
          },
        });
      }
    }
  });
  return getPickPage(token);
}
