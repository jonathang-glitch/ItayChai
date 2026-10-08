import { ConflictException, NotFoundException } from '@nestjs/common';
import { jerusalemDayKey, shiftLabelFromStart } from '@itay-chai/contracts';
import { Prisma, prisma, withTenantDb } from '@itay-chai/database';
import { assertShiftWindow, OPEN_SEARCH, ownerStore } from './roster.shared';

export async function listShifts() {
  const { tenantId, storeId } = await ownerStore();
  const shifts = await prisma.shift.findMany({
    where: { tenantId, businessUnitId: storeId, endsAt: { gt: new Date() } },
    include: { employee: { select: { displayName: true } } },
    orderBy: { startsAt: 'asc' },
  });
  return {
    shifts: shifts.map((shift) => ({
      id: shift.id,
      employeeId: shift.employeeId,
      employeeName: shift.employee.displayName,
      label: shift.label,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    })),
  };
}

async function assertFreeDay(
  tenantId: string,
  employeeId: string,
  startsAt: Date,
  exceptShiftId?: string,
) {
  const shifts = await prisma.shift.findMany({
    where: { tenantId, employeeId, ...(exceptShiftId ? { id: { not: exceptShiftId } } : {}) },
    select: { startsAt: true },
  });
  const day = jerusalemDayKey(startsAt);
  if (shifts.some((shift) => jerusalemDayKey(shift.startsAt) === day)) {
    throw new ConflictException('Shift already exists that day');
  }
}

export async function createShift(input: { employeeId: string; startsAt: string; endsAt: string }) {
  const { tenantId, storeId } = await ownerStore();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  assertShiftWindow(startsAt, endsAt);
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, tenantId, businessUnitId: storeId },
    select: { id: true },
  });
  if (!employee) {
    throw new NotFoundException('Worker not found');
  }
  await assertFreeDay(tenantId, employee.id, startsAt);
  const shift = await withTenantDb(tenantId, (tx) =>
    tx.shift.create({
      data: {
        tenantId,
        businessUnitId: storeId,
        employeeId: employee.id,
        label: shiftLabelFromStart(startsAt),
        startsAt,
        endsAt,
      },
    }),
  );
  return {
    id: shift.id,
    employeeId: shift.employeeId,
    label: shift.label,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
  };
}

export async function updateShift(shiftId: string, input: { startsAt: string; endsAt: string }) {
  const { tenantId, storeId } = await ownerStore();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  assertShiftWindow(startsAt, endsAt);
  const current = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId, businessUnitId: storeId },
    select: { id: true, employeeId: true },
  });
  if (!current) {
    throw new NotFoundException('Shift not found');
  }
  await assertFreeDay(tenantId, current.employeeId, startsAt, current.id);
  const shift = await withTenantDb(tenantId, (tx) =>
    tx.shift.update({
      where: { id: current.id },
      data: { label: shiftLabelFromStart(startsAt), startsAt, endsAt },
    }),
  );
  return {
    id: shift.id,
    employeeId: shift.employeeId,
    label: shift.label,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
  };
}

export async function deleteShift(shiftId: string) {
  const { tenantId, storeId } = await ownerStore();
  const current = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId, businessUnitId: storeId },
    select: { id: true },
  });
  if (!current) {
    throw new NotFoundException('Shift not found');
  }
  await withTenantDb(tenantId, (tx) =>
    removeShiftIn(tx, tenantId, current.id, 'Shift is in an open search'),
  );
  return { ok: true };
}

export async function removeShiftIn(
  tx: Prisma.TransactionClient,
  tenantId: string,
  shiftId: string,
  busy: string,
) {
  const openRequest = await tx.shiftSwapRequest.findFirst({
    where: {
      tenantId,
      status: { in: [...OPEN_SEARCH] },
      OR: [{ shiftId }, { proposedShiftId: shiftId }],
    },
    select: { id: true },
  });
  const openOffer = await tx.shiftOffer.findFirst({
    where: { tenantId, proposedShiftId: shiftId, status: { in: ['PENDING', 'QUEUED'] } },
    select: { id: true },
  });
  if (openRequest || openOffer) {
    throw new ConflictException(busy);
  }
  await tx.shiftSwapRequest.updateMany({ where: { tenantId, shiftId }, data: { shiftId: null } });
  await tx.shiftSwapRequest.updateMany({
    where: { tenantId, proposedShiftId: shiftId },
    data: { proposedShiftId: null },
  });
  await tx.shiftOffer.updateMany({
    where: { tenantId, proposedShiftId: shiftId },
    data: { proposedShiftId: null },
  });
  await tx.shift.delete({ where: { id: shiftId } });
}
