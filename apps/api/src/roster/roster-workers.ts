import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { hashPassword } from '@itay-chai/auth';
import { WHATSAPP_PROVIDER } from '@itay-chai/contracts';
import { prisma, withTenantDb } from '@itay-chai/database';
import { assertWhatsAppFree, requireWhatsAppNumber } from '../auth/phone';
import { customerRoleId, OPEN_SEARCH, ownerStore } from './roster.shared';

export async function listWorkers() {
  const { tenantId, storeId } = await ownerStore();
  const workers = await prisma.employee.findMany({
    where: { tenantId, businessUnitId: storeId, userId: { not: null } },
    include: {
      user: { select: { email: true } },
      shifts: { where: { endsAt: { gt: new Date() } }, select: { id: true } },
    },
    orderBy: { displayName: 'asc' },
  });
  const userIds = workers.flatMap((worker) => (worker.userId ? [worker.userId] : []));
  const phones = await prisma.stakeholderIdentity.findMany({
    where: { tenantId, channel: WHATSAPP_PROVIDER, userId: { in: userIds } },
    select: { userId: true, externalId: true },
  });
  const phoneOf = new Map(phones.map((row) => [row.userId, row.externalId]));
  return {
    workers: workers.map((worker) => ({
      id: worker.id,
      name: worker.displayName,
      email: worker.user?.email ?? null,
      phone: worker.userId ? (phoneOf.get(worker.userId) ?? null) : null,
      upcomingShifts: worker.shifts.length,
    })),
  };
}

export async function createWorker(input: { name: string; email: string; password: string; whatsapp: string }) {
  const { tenantId, storeId } = await ownerStore();
  const email = input.email.trim().toLowerCase();
  const phone = requireWhatsAppNumber(input.whatsapp);
  const name = input.name.trim();
  const taken = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (taken) {
    throw new ConflictException('Email already registered');
  }
  await assertWhatsAppFree(phone);
  const roleId = await customerRoleId();
  const userId = randomUUID();
  const employee = await withTenantDb(tenantId, async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        authSubject: `worker-${userId}`,
        email,
        name,
        passwordHash: hashPassword(input.password),
      },
    });
    await tx.tenantMembership.create({
      data: {
        tenantId,
        userId,
        roleId,
        businessUnitId: storeId,
        status: 'ACTIVE',
      },
    });
    await tx.stakeholderIdentity.create({
      data: {
        tenantId,
        userId,
        channel: WHATSAPP_PROVIDER,
        externalId: phone,
        verifiedAt: new Date(),
      },
    });
    return tx.employee.create({
      data: {
        tenantId,
        businessUnitId: storeId,
        userId,
        displayName: name,
        roleLabel: 'עובד',
      },
    });
  });
  return { id: employee.id, name, email, phone, password: input.password };
}

export async function updateWorker(
  employeeId: string,
  input: { name?: string; password?: string; whatsapp?: string },
) {
  const { tenantId, storeId } = await ownerStore();
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId, businessUnitId: storeId },
    select: { id: true, userId: true },
  });
  if (!employee?.userId) {
    throw new NotFoundException('Worker not found');
  }
  const userId = employee.userId;
  const phone = input.whatsapp ? requireWhatsAppNumber(input.whatsapp) : undefined;
  if (phone) {
    await assertWhatsAppFree(phone, userId);
  }
  const name = input.name?.trim();
  await withTenantDb(tenantId, async (tx) => {
    if (name) {
      await tx.employee.update({ where: { id: employee.id }, data: { displayName: name } });
      await tx.user.update({ where: { id: userId }, data: { name } });
    }
    if (input.password) {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: hashPassword(input.password) },
      });
    }
    if (phone) {
      await tx.stakeholderIdentity.deleteMany({
        where: { tenantId, userId, channel: WHATSAPP_PROVIDER },
      });
      await tx.stakeholderIdentity.create({
        data: {
          tenantId,
          userId,
          channel: WHATSAPP_PROVIDER,
          externalId: phone,
          verifiedAt: new Date(),
        },
      });
    }
  });
  return {
    id: employee.id,
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(input.password ? { password: input.password } : {}),
  };
}

export async function deleteWorker(employeeId: string) {
  const { tenantId, storeId } = await ownerStore();
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId, businessUnitId: storeId },
    select: { id: true, userId: true },
  });
  if (!employee?.userId) {
    throw new NotFoundException('Worker not found');
  }
  const userId = employee.userId;
  await withTenantDb(tenantId, async (tx) => {
    const openRequest = await tx.shiftSwapRequest.findFirst({
      where: {
        tenantId,
        status: { in: [...OPEN_SEARCH] },
        OR: [{ employeeId: employee.id }, { counterpartEmployeeId: employee.id }],
      },
      select: { id: true },
    });
    const openOffer = await tx.shiftOffer.findFirst({
      where: { tenantId, employeeId: employee.id, status: { in: ['PENDING', 'QUEUED'] } },
      select: { id: true },
    });
    if (openRequest || openOffer) {
      throw new ConflictException('Worker has an open search');
    }
    const requests = await tx.shiftSwapRequest.findMany({
      where: { tenantId, employeeId: employee.id },
      select: { id: true },
    });
    const requestIds = requests.map((row) => row.id);
    if (requestIds.length) {
      await tx.shiftOffer.deleteMany({ where: { tenantId, requestId: { in: requestIds } } });
    }
    await tx.shiftOffer.deleteMany({ where: { tenantId, employeeId: employee.id } });
    await tx.shiftSwapRequest.updateMany({
      where: { tenantId, counterpartEmployeeId: employee.id },
      data: { counterpartEmployeeId: null },
    });
    await tx.shiftSwapRequest.deleteMany({ where: { tenantId, employeeId: employee.id } });
    const shifts = await tx.shift.findMany({
      where: { tenantId, employeeId: employee.id },
      select: { id: true },
    });
    const shiftIds = shifts.map((row) => row.id);
    if (shiftIds.length) {
      await tx.shiftSwapRequest.updateMany({
        where: { tenantId, shiftId: { in: shiftIds } },
        data: { shiftId: null },
      });
      await tx.shiftSwapRequest.updateMany({
        where: { tenantId, proposedShiftId: { in: shiftIds } },
        data: { proposedShiftId: null },
      });
      await tx.shiftOffer.updateMany({
        where: { tenantId, proposedShiftId: { in: shiftIds } },
        data: { proposedShiftId: null },
      });
      await tx.shift.deleteMany({ where: { tenantId, id: { in: shiftIds } } });
    }
    await tx.employee.delete({ where: { id: employee.id } });
    await tx.tenantMembership.updateMany({
      where: { tenantId, userId, role: { name: 'customer' } },
      data: { status: 'DISABLED' },
    });
    await tx.stakeholderIdentity.deleteMany({
      where: { tenantId, userId, channel: WHATSAPP_PROVIDER },
    });
  });
  return { ok: true };
}

export async function getShop() {
  const { tenantId, userId, shopName } = await ownerStore();
  const identity = await prisma.stakeholderIdentity.findFirst({
    where: { tenantId, userId, channel: WHATSAPP_PROVIDER },
    select: { externalId: true },
  });
  return { shopName, whatsapp: identity?.externalId ?? null };
}

export async function updateOwnerPhone(whatsapp: string) {
  const { tenantId, userId } = await ownerStore();
  const phone = requireWhatsAppNumber(whatsapp);
  await assertWhatsAppFree(phone, userId);
  await withTenantDb(tenantId, async (tx) => {
    await tx.stakeholderIdentity.deleteMany({
      where: { tenantId, userId, channel: WHATSAPP_PROVIDER },
    });
    await tx.stakeholderIdentity.create({
      data: {
        tenantId,
        userId,
        channel: WHATSAPP_PROVIDER,
        externalId: phone,
        verifiedAt: new Date(),
      },
    });
  });
  return { whatsapp: phone };
}
