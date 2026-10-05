import { BadRequestException } from '@nestjs/common';
import { requireTenantContext } from '@itay-chai/auth';
import { jerusalemDayKey, ROLE_NAMES } from '@itay-chai/contracts';
import { prisma } from '@itay-chai/database';

export const OPEN_SEARCH = ['OPEN', 'SEEKING', 'MATCH_PROPOSED'] as const;

export async function ownerStore() {
  const { tenantId, userId } = requireTenantContext();
  if (!userId) {
    throw new BadRequestException('Authenticated user is required');
  }
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId, status: 'ACTIVE', role: { name: ROLE_NAMES.OWNER } },
    select: { businessUnitId: true, businessUnit: { select: { name: true } } },
  });
  if (!membership?.businessUnitId) {
    throw new BadRequestException('Shop store is missing');
  }
  return { tenantId, userId, storeId: membership.businessUnitId, shopName: membership.businessUnit?.name ?? '' };
}

export async function customerRoleId() {
  const role = await prisma.role.findFirst({
    where: { name: ROLE_NAMES.CUSTOMER, tenantId: null },
    select: { id: true },
  });
  if (!role) {
    throw new Error('Customer role is missing');
  }
  return role.id;
}

export function assertShiftWindow(startsAt: Date, endsAt: Date) {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new BadRequestException('Enter a start and end');
  }
  if (endsAt <= startsAt) {
    throw new BadRequestException('End must be after start');
  }
  if (jerusalemDayKey(startsAt) !== jerusalemDayKey(endsAt)) {
    throw new BadRequestException('Shift must start and end on the same day');
  }
}

