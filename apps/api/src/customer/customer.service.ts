import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { requireTenantContext } from '@itay-chai/auth';
import {
  customerRequestPrefix,
  requestIntentText,
  shiftLabelFromStart,
  swapRequestText,
  type ShiftMatchAction,
  type ShiftOfferAction,
  type ShiftRequestKind,
} from '@itay-chai/contracts';
import {
  cancelShiftSearch,
  confirmMatch,
  createShiftRequestForSession,
  findCustomerSessions,
  findSessionForTenant,
  listIncomingOffers,
  listMyShifts,
  prisma,
  remindOpenSwap,
  replaceOpenSearches,
  respondToOffer,
  startShiftSearch,
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
    return { requests: [], shifts: [], offers: [] };
  }
  const [requests, shifts, offers] = await Promise.all([
    listCustomerRequests(),
    listCustomerShifts(),
    listIncomingOffers(userId),
  ]);
  return { requests, shifts, offers };
}

function isDbUnreachable(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && ['P1001', 'P1017'].includes(String(error.code));
}

function mapAgentError(error: unknown): never {
  if (isDbUnreachable(error)) {
    throw new ServiceUnavailableException('Request timeout');
  }
  const message = error instanceof Error ? error.message : 'Shift request failed';
  if (message === 'Offer not found' || message === 'Match not found' || message === 'Search not found') {
    throw new NotFoundException(message);
  }
  if (message === 'כבר נתפס.') {
    throw new ConflictException(message);
  }
  throw new BadRequestException(message);
}

export async function answerOffer(offerId: string, action: ShiftOfferAction, proposedShiftId?: string) {
  try {
    await respondToOffer(offerId, action, proposedShiftId);
  } catch (error) {
    mapAgentError(error);
  }
  return { ok: true };
}

export async function answerMatch(sessionId: string, action: ShiftMatchAction) {
  try {
    await confirmMatch(sessionId, action);
  } catch (error) {
    mapAgentError(error);
  }
  return { ok: true };
}

export async function cancelCustomerSearch(sessionId: string) {
  try {
    await cancelShiftSearch(sessionId);
  } catch (error) {
    mapAgentError(error);
  }
  return listCustomerHome();
}

export async function createCustomerRequest(input: {
  text?: string;
  shiftId?: string;
  kind?: ShiftRequestKind;
}) {
  const { tenantId, userId } = requireTenantContext();
  if (!userId) {
    throw new Error('Customer user is required');
  }
  try {
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
    if (input.shiftId && (!shift || (employee && shift.employeeId !== employee.id))) {
      throw new BadRequestException('Shift is not on this employee roster');
    }
    if (employee) {
      await replaceOpenSearches(employee.id, input.shiftId);
    }
    if (input.shiftId) {
      const open = await prisma.shiftSwapRequest.findFirst({
        where: { shiftId: input.shiftId, status: { in: ['SEEKING', 'MATCH_PROPOSED'] } },
      });
      if (open) {
        await remindOpenSwap(open.id);
        return (await findSessionForTenant(open.sessionId)) ?? (await findCustomerSessions(userId))[0];
      }
    }
    const label = shift ? shiftLabelFromStart(shift.startsAt) : undefined;
    const text =
      input.text?.trim() ||
      (label ? (input.kind ? requestIntentText(input.kind, label) : swapRequestText(label)) : 'צריך החלפת משמרת');
    const businessUnitId = membership?.businessUnitId ?? employee?.businessUnitId;
    const created = await ingestMockWhatsApp(
      {
        externalMessageId: `${customerRequestPrefix(userId)}${randomUUID()}`,
        text,
      },
      {
        tenantId,
        customerUserId: userId,
        ...(businessUnitId ? { businessUnitId } : {}),
      },
    );
    try {
      const request = await createShiftRequestForSession({
        tenantId,
        sessionId: created.sessionId,
        userId,
        text,
        shiftId: input.shiftId,
        ...(employee ? { employeeId: employee.id } : {}),
        ...(label ? { requestedLabel: label } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
      });
      if (request && input.kind) {
        await startShiftSearch(request.id);
      }
    } catch (error) {
      if (isDbUnreachable(error)) {
        throw error;
      }
      throw new BadRequestException(error instanceof Error ? error.message : 'Shift request failed');
    }
    return (await findSessionForTenant(created.sessionId)) ?? (await findCustomerSessions(userId))[0];
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    if (isDbUnreachable(error)) {
      throw new ServiceUnavailableException('Request timeout');
    }
    throw error;
  }
}
