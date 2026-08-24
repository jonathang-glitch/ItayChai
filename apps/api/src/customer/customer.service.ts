import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { requireTenantContext } from '@itay-chai/auth';
import { customerRequestPrefix, shiftLabelFromStart, swapRequestText } from '@itay-chai/contracts';
import {
  createShiftRequestForSession,
  findCustomerSessions,
  findSessionForTenant,
  listMyShifts,
  prisma,
} from '@itay-chai/database';
import { ingestMockWhatsApp } from '../webhooks/whatsapp/whatsapp-webhook.service';

export async function listCustomerRequests() {
  const { userId } = requireTenantContext();
  if (!userId) {
    return [];
  }
  return findCustomerSessions(userId);
}

export async function listCustomerShifts() {
  const { userId } = requireTenantContext();
  if (!userId) {
    return [];
  }
  return listMyShifts(userId);
}

export async function listCustomerHome() {
  const { userId } = requireTenantContext();
  if (!userId) {
    return { requests: [], shifts: [] };
  }
  const [requests, shifts] = await Promise.all([listCustomerRequests(), listCustomerShifts()]);
  return { requests, shifts };
}

export async function createCustomerRequest(input: { text?: string; shiftId?: string }) {
  const { tenantId, userId } = requireTenantContext();
  if (!userId) {
    throw new Error('Customer user is required');
  }
  const [membership, shift, employee] = await Promise.all([
    prisma.tenantMembership.findFirst({
      where: { tenantId, userId, status: 'ACTIVE' },
    }),
    input.shiftId
      ? prisma.shift.findFirst({
          where: { id: input.shiftId, tenantId },
        })
      : Promise.resolve(null),
    prisma.employee.findFirst({
      where: { tenantId, userId },
    }),
  ]);
  if (input.shiftId && !shift) {
    throw new BadRequestException('Shift is not on this employee roster');
  }
  const label = shift ? shiftLabelFromStart(shift.startsAt) : undefined;
  const text = input.text?.trim() || (label ? swapRequestText(label) : 'צריך החלפת משמרת');
  const created = await ingestMockWhatsApp(
    {
      externalMessageId: `${customerRequestPrefix(userId)}${randomUUID()}`,
      text,
    },
    {
      tenantId,
      customerUserId: userId,
      ...(membership?.businessUnitId ? { businessUnitId: membership.businessUnitId } : {}),
    },
  );
  try {
    await createShiftRequestForSession({
      tenantId,
      sessionId: created.sessionId,
      userId,
      text,
      shiftId: input.shiftId,
      ...(employee ? { employeeId: employee.id } : {}),
      ...(label ? { requestedLabel: label } : {}),
    });
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : 'Shift request failed');
  }
  return (await findSessionForTenant(created.sessionId)) ?? (await findCustomerSessions(userId))[0];
}
