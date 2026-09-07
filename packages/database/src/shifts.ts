import { requireTenantContext } from '@itay-chai/auth';
import {
  phraseShiftLabel,
  shiftLabelFromStart,
  WHATSAPP_PROVIDER,
  type ShiftRequestKind,
} from '@itay-chai/contracts';
import { prisma } from './index.js';
import { closeOffersForDecision } from './shift-agent.js';
import { intentText, searchSummary, shiftTalk } from './shift-copy.js';
import { enqueueWhatsAppSendNow } from './whatsapp-send.js';

const ACTION_TO_STATUS = {
  approve: 'APPROVED',
  reject: 'REJECTED',
  needs_replacement: 'NEEDS_REPLACEMENT',
} as const;

const DECISION_REPLY = {
  approve: 'הבקשה אושרה.',
  reject: 'הבקשה נדחתה.',
  needs_replacement: 'צריך מחליף למשמרת.',
} as const;

export type ShiftDecisionAction = keyof typeof ACTION_TO_STATUS;

export function presentShift(shift: {
  id: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
}) {
  return {
    id: shift.id,
    label: shiftLabelFromStart(shift.startsAt),
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
  };
}

export function presentShiftRequest(
  request:
    | {
        id: string;
        status: string;
        kind?: string;
        intentText: string;
        requestedLabel: string;
        shift: { id: string; label: string; startsAt: Date; endsAt: Date } | null;
        employee: { displayName: string };
        counterpart?: { displayName: string } | null;
        proposedShift?: { id: string; label: string; startsAt: Date; endsAt: Date } | null;
        offers?: {
          id: string;
          status: string;
          allowCover: boolean;
          allowSwap: boolean;
          employee: { displayName: string };
          proposedShift: { startsAt: Date; endsAt: Date } | null;
        }[];
      }
    | null
    | undefined,
) {
  if (!request) {
    return null;
  }
  const names = (request.offers ?? []).map((offer) => offer.employee.displayName);
  const match = request.counterpart
    ? {
        name: request.counterpart.displayName,
        offered: request.proposedShift
          ? shiftTalk(request.proposedShift.startsAt)
          : '',
      }
    : null;
  return {
    id: request.id,
    status: request.status,
    kind: request.kind ?? 'COVER',
    intentText: request.intentText,
    requestedLabel: request.shift
      ? shiftLabelFromStart(request.shift.startsAt)
      : phraseShiftLabel(request.requestedLabel),
    employeeName: request.employee.displayName,
    shift: request.shift ? presentShift(request.shift) : null,
    proposedShift: request.proposedShift ? presentShift(request.proposedShift) : null,
    counterpartName: request.counterpart?.displayName ?? null,
    searchSummary: searchSummary((request.kind ?? 'COVER') as ShiftRequestKind, request.status, names, match),
    offers: (request.offers ?? []).map((offer) => ({
      id: offer.id,
      status: offer.status,
      employeeName: offer.employee.displayName,
      allowCover: offer.allowCover,
      allowSwap: offer.allowSwap,
    })),
  };
}

export async function listShiftsForUser(userId: string, tenantId?: string) {
  const shifts = await prisma.shift.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      employee: { userId },
      swapRequests: { none: { status: 'APPROVED' } },
    },
    orderBy: { startsAt: 'asc' },
  });
  return shifts.map(presentShift);
}

export async function listMyShifts(userId: string) {
  const { tenantId } = requireTenantContext();
  return listShiftsForUser(userId, tenantId);
}

export async function createShiftRequestForSession(input: {
  tenantId: string;
  sessionId: string;
  userId: string;
  text: string;
  shiftId?: string;
  employeeId?: string;
  requestedLabel?: string;
  kind?: ShiftRequestKind;
}) {
  const employee = input.employeeId
    ? { id: input.employeeId }
    : await prisma.employee.findFirst({
        where: { tenantId: input.tenantId, userId: input.userId },
      });
  if (!employee) {
    return null;
  }

  let requestedLabel = input.requestedLabel ?? input.text;
  let shiftId: string | null = input.shiftId ?? null;
  if (input.shiftId && !input.requestedLabel) {
    const shift = await prisma.shift.findFirst({
      where: { id: input.shiftId, tenantId: input.tenantId, employeeId: employee.id },
    });
    if (!shift) {
      throw new Error('Shift is not on this employee roster');
    }
    shiftId = shift.id;
    requestedLabel = shiftLabelFromStart(shift.startsAt);
  }
  if (shiftId) {
    const open = await prisma.shiftSwapRequest.findFirst({
      where: { shiftId, status: { in: ['SEEKING', 'MATCH_PROPOSED'] } },
    });
    if (open) {
      return open;
    }
  }
  const kind = input.kind ?? 'COVER';
  return prisma.shiftSwapRequest.create({
    data: {
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      employeeId: employee.id,
      shiftId,
      kind,
      intentText: input.kind ? intentText(input.kind, requestedLabel) : input.text,
      requestedLabel,
      status: 'OPEN',
    },
  });
}

export async function decideShiftRequest(sessionId: string, action: ShiftDecisionAction) {
  const context = requireTenantContext();
  let request = await prisma.shiftSwapRequest.findFirst({
    where: { tenantId: context.tenantId, sessionId },
  });
  if (!request) {
    const session = await prisma.agentSession.findFirst({
      where: { tenantId: context.tenantId, id: sessionId },
      include: { messages: { where: { direction: 'INBOUND' }, take: 1 } },
    });
    if (!session?.customerUserId) {
      return null;
    }
    const employee = await prisma.employee.findFirst({
      where: { tenantId: context.tenantId, userId: session.customerUserId },
    });
    if (!employee) {
      return null;
    }
    const inbound = session.messages[0];
    request = await prisma.shiftSwapRequest.create({
      data: {
        tenantId: context.tenantId,
        sessionId,
        employeeId: employee.id,
        intentText: inbound?.body ?? 'החלפה',
        requestedLabel: inbound?.body ?? 'החלפה',
        status: 'OPEN',
      },
    });
  }

  const updated = await prisma.shiftSwapRequest.update({
    where: { id: request.id },
    data: {
      status: ACTION_TO_STATUS[action],
      decidedByUserId: context.userId ?? null,
      decidedAt: new Date(),
    },
  });
  if (action !== 'approve') {
    await closeOffersForDecision(updated.id, context.tenantId);
  }
  const afterApprove =
    action === 'approve' && updated.shiftId
      ? prisma.shift.delete({ where: { id: updated.shiftId } }).catch(() => null)
      : Promise.resolve(null);
  await Promise.all([
    afterApprove,
    prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' },
    }),
    prisma.message.create({
      data: {
        tenantId: context.tenantId,
        sessionId,
        direction: 'OUTBOUND',
        channel: WHATSAPP_PROVIDER,
        body: DECISION_REPLY[action],
      },
    }),
    prisma.auditEntry.create({
      data: {
        tenantId: context.tenantId,
        actorType: context.actorType,
        action: `shift.${action}`,
        resourceType: 'ShiftSwapRequest',
        resourceId: updated.id,
        metadata: { sessionId, userId: context.userId ?? null },
      },
    }),
  ]);
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
    select: { customerUserId: true },
  });
  if (session?.customerUserId) {
    await enqueueWhatsAppSendNow({
      tenantId: context.tenantId,
      userId: session.customerUserId,
      body: DECISION_REPLY[action],
      aggregateType: 'AgentSession',
      aggregateId: sessionId,
    });
  }
  return updated;
}
