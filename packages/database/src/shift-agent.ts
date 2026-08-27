import type { Prisma } from '@prisma/client';
import { requireTenantContext } from '@itay-chai/auth';
import {
  jerusalemDayKey,
  jerusalemWeekKey,
  jerusalemWeekday,
  shiftLabelFromStart,
  WHATSAPP_PROVIDER,
  type ShiftMatchAction,
  type ShiftOfferAction,
  type ShiftRequestKind,
} from '@itay-chai/contracts';
import { prisma } from './index.js';
import * as copy from './shift-copy.js';

type Tx = Prisma.TransactionClient;

const OPEN_OFFER = ['PENDING', 'QUEUED', 'ACCEPTED'] as const;
const ACTIVE_SEARCH = ['SEEKING', 'MATCH_PROPOSED'] as const;

function wantedLabel(startsAt: Date) {
  return copy.shiftTalkWithDate(startsAt);
}

function weeksAround(startsAt: Date) {
  const weeks = new Set([jerusalemWeekKey(startsAt)]);
  if (jerusalemWeekday(startsAt) >= 5) {
    weeks.add(jerusalemWeekKey(new Date(startsAt.getTime() + 7 * 86_400_000)));
  }
  return weeks;
}

function inRequestedWeeks(shiftAt: Date, wantedAt: Date) {
  return weeksAround(wantedAt).has(jerusalemWeekKey(shiftAt));
}

function swapChoicesFor(
  coworkerShifts: { id: string; startsAt: Date; endsAt: Date; label: string }[],
  requesterDays: Set<string>,
  wantedAt?: Date,
) {
  return coworkerShifts
    .filter((shift) => !requesterDays.has(jerusalemDayKey(shift.startsAt)))
    .filter((shift) => !wantedAt || inRequestedWeeks(shift.startsAt, wantedAt))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

function presentShiftItem(shift: { id: string; startsAt: Date; endsAt: Date }) {
  return {
    id: shift.id,
    label: shiftLabelFromStart(shift.startsAt),
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
  };
}

async function writeOutbound(tx: Tx, tenantId: string, sessionId: string, body: string) {
  await tx.message.create({
    data: {
      tenantId,
      sessionId,
      direction: 'OUTBOUND',
      channel: WHATSAPP_PROVIDER,
      body,
    },
  });
}

async function writePeerNotice(
  tx: Tx,
  tenantId: string,
  employeeId: string,
  body: string,
  requestId: string,
) {
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: { userId: true, businessUnitId: true },
  });
  if (!employee?.userId) {
    return;
  }
  const externalMessageId = `notice:${employee.userId}:${requestId}`;
  const session = await tx.agentSession.upsert({
    where: { tenantId_externalMessageId: { tenantId, externalMessageId } },
    create: {
      tenantId,
      customerUserId: employee.userId,
      businessUnitId: employee.businessUnitId,
      externalMessageId,
      status: 'COMPLETED',
    },
    update: { status: 'COMPLETED' },
  });
  await writeOutbound(tx, tenantId, session.id, body);
}

export async function startShiftSearch(requestId: string) {
  const request = await prisma.shiftSwapRequest.findUnique({
    where: { id: requestId },
    include: {
      shift: { select: { id: true, businessUnitId: true, startsAt: true, endsAt: true } },
      employee: { select: { shifts: { select: { startsAt: true } } } },
    },
  });
  if (!request?.shift) {
    return request;
  }

  const day = jerusalemDayKey(request.shift.startsAt);
  const requesterDays = new Set(request.employee.shifts.map((shift) => jerusalemDayKey(shift.startsAt)));
  const coworkers = await prisma.employee.findMany({
    where: {
      tenantId: request.tenantId,
      businessUnitId: request.shift.businessUnitId,
      id: { not: request.employeeId },
      userId: { not: null },
    },
    select: {
      id: true,
      displayName: true,
      shifts: { select: { id: true, label: true, startsAt: true, endsAt: true } },
    },
  });

  const kind = request.kind as ShiftRequestKind;
  const offers: {
    tenantId: string;
    requestId: string;
    employeeId: string;
    proposedShiftId: string | null;
    allowCover: boolean;
    allowSwap: boolean;
  }[] = [];
  const names: string[] = [];
  for (const coworker of coworkers) {
    const busy = coworker.shifts.some((shift) => jerusalemDayKey(shift.startsAt) === day);
    if (busy) {
      continue;
    }
    const choices = swapChoicesFor(coworker.shifts, requesterDays, request.shift.startsAt);
    const allowCover = kind === 'COVER' || kind === 'EITHER';
    const allowSwap = (kind === 'SWAP' || kind === 'EITHER') && choices.length > 0;
    if (!allowCover && !allowSwap) {
      continue;
    }
    names.push(coworker.displayName);
    offers.push({
      tenantId: request.tenantId,
      requestId: request.id,
      employeeId: coworker.id,
      proposedShiftId: null,
      allowCover,
      allowSwap,
    });
  }

  const label = shiftLabelFromStart(request.shift.startsAt);
  const status = offers.length ? 'SEEKING' : 'UNFILLED';
  await prisma.$transaction(async (tx) => {
    if (offers.length) {
      await tx.shiftOffer.createMany({ data: offers });
    }
    await tx.shiftSwapRequest.update({
      where: { id: request.id },
      data: { status },
    });
    await writeOutbound(
      tx,
      request.tenantId,
      request.sessionId,
      offers.length ? copy.seekingMessage(kind, label) : copy.unfilled(label),
    );
    if (offers.length) {
      await writeOutbound(tx, request.tenantId, request.sessionId, copy.searchSummary(kind, 'SEEKING', names));
    }
  });
  return prisma.shiftSwapRequest.findUnique({ where: { id: request.id } });
}

export async function listIncomingOffers(userId: string) {
  const { tenantId } = requireTenantContext();
  const since = new Date();
  since.setDate(since.getDate() - 2);
  const rows = await prisma.shiftOffer.findMany({
    where: {
      tenantId,
      employee: { userId },
      createdAt: { gte: since },
      OR: [
        { status: 'PENDING', request: { status: { in: [...ACTIVE_SEARCH] } } },
        { status: 'ACCEPTED', request: { status: { in: ['MATCH_PROPOSED', 'COMMITTED'] } } },
        { status: 'QUEUED', request: { status: { in: [...ACTIVE_SEARCH] } } },
        { status: 'CANCELLED', request: { status: { in: ['COMMITTED', 'CANCELLED', 'REJECTED'] } } },
      ],
    },
    include: {
      employee: { select: { displayName: true, shifts: { select: { id: true, label: true, startsAt: true, endsAt: true } } } },
      proposedShift: { select: { id: true, label: true, startsAt: true, endsAt: true } },
      request: {
        select: {
          status: true,
          kind: true,
          shift: { select: { id: true, label: true, startsAt: true, endsAt: true } },
          employee: { select: { displayName: true, shifts: { select: { startsAt: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  return rows.map(presentOffer);
}

function offerResult(
  offer: {
    status: string;
    allowCover: boolean;
    allowSwap: boolean;
    proposedShift: { startsAt: Date } | null;
    request: {
      status: string;
      employee: { displayName: string };
      shift: { startsAt: Date } | null;
    };
  },
) {
  const wantedAt = offer.request.shift?.startsAt;
  const offeredAt = offer.proposedShift?.startsAt ?? null;
  if (offer.status === 'QUEUED') {
    return offer.allowCover ? copy.queuedCover() : copy.queuedSwap();
  }
  if (offer.status === 'ACCEPTED' && offer.request.status === 'MATCH_PROPOSED' && wantedAt) {
    return copy.swapProposed(offer.request.employee.displayName, wantedAt, offeredAt, false);
  }
  if (offer.status === 'ACCEPTED' && offer.request.status === 'COMMITTED' && wantedAt) {
    if (offer.allowSwap && offeredAt) {
      return copy.swapDonePeer(offer.request.employee.displayName, wantedAt, offeredAt);
    }
    return copy.coverCommitted(offer.request.employee.displayName, wantedLabel(wantedAt), true);
  }
  if (offer.status === 'CANCELLED') {
    return offer.request.status === 'COMMITTED' ? copy.noLongerNeeded() : copy.requestCancelled();
  }
  return null;
}

export function presentOffer(offer: {
  id: string;
  status: string;
  allowCover: boolean;
  allowSwap: boolean;
  createdAt: Date;
  employee: { displayName: string; shifts: { id: string; label: string; startsAt: Date; endsAt: Date }[] };
  proposedShift: { id: string; label: string; startsAt: Date; endsAt: Date } | null;
  request: {
    status: string;
    kind: string;
    employee: { displayName: string; shifts: { startsAt: Date }[] };
    shift: { id: string; label: string; startsAt: Date; endsAt: Date } | null;
  };
}) {
  const wantedAt = offer.request.shift?.startsAt;
  const wanted = wantedAt ? wantedLabel(wantedAt) : '';
  const requester = offer.request.employee.displayName;
  const requesterDays = new Set(offer.request.employee.shifts.map((shift) => jerusalemDayKey(shift.startsAt)));
  const swapChoices = offer.allowSwap && wantedAt ? swapChoicesFor(offer.employee.shifts, requesterDays, wantedAt) : [];
  const weekShifts = wantedAt
    ? [...offer.employee.shifts]
        .filter((shift) => inRequestedWeeks(shift.startsAt, wantedAt))
        .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
    : [];
  let prompt = copy.coverAsk(requester, wanted);
  if (offer.allowCover && offer.allowSwap) {
    prompt = copy.eitherAsk(requester, wanted);
  } else if (offer.allowSwap) {
    prompt = copy.swapAsk(requester, wanted);
  }
  return {
    id: offer.id,
    status: offer.status,
    allowCover: offer.allowCover,
    allowSwap: offer.allowSwap,
    prompt,
    result: offerResult(offer),
    createdAt: offer.createdAt,
    requesterName: requester,
    requestedShift: offer.request.shift,
    proposedShift: offer.proposedShift,
    weekShifts: weekShifts.map(presentShiftItem),
    swapChoices: swapChoices.map(presentShiftItem),
    requestStatus: offer.request.status,
  };
}

export async function respondToOffer(offerId: string, action: ShiftOfferAction, proposedShiftId?: string) {
  const { tenantId, userId } = requireTenantContext();
  if (!userId) {
    throw new Error('User is required');
  }
  return prisma.$transaction(async (tx) => {
    const offer = await tx.shiftOffer.findFirst({
      where: { id: offerId, tenantId, employee: { userId } },
      include: {
        employee: { select: { displayName: true, shifts: { select: { id: true, label: true, startsAt: true, endsAt: true } } } },
        proposedShift: { select: { id: true, startsAt: true, endsAt: true } },
        request: {
          select: {
            id: true,
            tenantId: true,
            sessionId: true,
            kind: true,
            status: true,
            shift: { select: { id: true, startsAt: true, endsAt: true } },
            employee: { select: { displayName: true, shifts: { select: { startsAt: true } } } },
          },
        },
      },
    });
    if (!offer?.request.shift) {
      throw new Error('Offer not found');
    }
    if (offer.status !== 'PENDING') {
      throw new Error(copy.alreadyTaken());
    }
    if (action === 'decline') {
      await tx.shiftOffer.update({
        where: { id: offer.id },
        data: { status: 'DECLINED', respondedAt: new Date() },
      });
      await maybeUnfilled(tx, offer.request);
      return { ok: true };
    }
    const shift = offer.request.shift;
    if (action === 'cover') {
      if (!offer.allowCover) {
        throw new Error('Cover is not offered');
      }
      return commitCover(tx, {
        id: offer.id,
        employeeId: offer.employeeId,
        employee: offer.employee,
        request: {
          id: offer.request.id,
          tenantId: offer.request.tenantId,
          sessionId: offer.request.sessionId,
          kind: offer.request.kind,
          status: offer.request.status,
          shift,
        },
      });
    }
    const requesterDays = new Set(offer.request.employee.shifts.map((row) => jerusalemDayKey(row.startsAt)));
    const choices = swapChoicesFor(offer.employee.shifts, requesterDays, shift.startsAt);
    const chosenId = proposedShiftId ?? offer.proposedShiftId;
    const chosen = choices.find((row) => row.id === chosenId);
    if (!offer.allowSwap || !chosen) {
      throw new Error('Swap is not offered');
    }
    return proposeSwap(tx, {
      id: offer.id,
      employeeId: offer.employeeId,
      proposedShiftId: chosen.id,
      employee: offer.employee,
      proposedShift: chosen,
      request: {
        id: offer.request.id,
        tenantId: offer.request.tenantId,
        sessionId: offer.request.sessionId,
        shift,
        requesterName: offer.request.employee.displayName,
      },
    });
  });
}

async function commitCover(
  tx: Tx,
  offer: {
    id: string;
    employeeId: string;
    employee: { displayName: string };
    request: {
      id: string;
      tenantId: string;
      sessionId: string;
      kind: string;
      status: string;
      shift: { id: string; startsAt: Date; endsAt: Date };
    };
  },
) {
  if (offer.request.status === 'MATCH_PROPOSED' && offer.request.kind === 'EITHER') {
    await tx.shiftOffer.update({
      where: { id: offer.id },
      data: { status: 'QUEUED', allowCover: true, allowSwap: false, respondedAt: new Date() },
    });
    await writeOutbound(tx, offer.request.tenantId, offer.request.sessionId, copy.queuedCover());
    return { ok: true, queued: true };
  }
  const moved = await tx.shiftSwapRequest.updateMany({
    where: { id: offer.request.id, status: 'SEEKING' },
    data: {
      status: 'COMMITTED',
      counterpartEmployeeId: offer.employeeId,
      decidedAt: new Date(),
    },
  });
  if (moved.count !== 1) {
    throw new Error(copy.alreadyTaken());
  }
  const wanted = wantedLabel(offer.request.shift.startsAt);
  await tx.shift.update({
    where: { id: offer.request.shift.id },
    data: { employeeId: offer.employeeId },
  });
  await tx.shiftOffer.update({
    where: { id: offer.id },
    data: { status: 'ACCEPTED', respondedAt: new Date() },
  });
  await closeOpenOffers(tx, {
    requestId: offer.request.id,
    tenantId: offer.request.tenantId,
    statuses: ['PENDING', 'QUEUED'],
    message: copy.noLongerNeeded(),
  });
  await writeOutbound(
    tx,
    offer.request.tenantId,
    offer.request.sessionId,
    copy.coverCommitted(offer.employee.displayName, wanted, false),
  );
  await writePeerNotice(
    tx,
    offer.request.tenantId,
    offer.employeeId,
    copy.coverCommitted(offer.employee.displayName, wanted, true),
    offer.request.id,
  );
  return { ok: true };
}

async function proposeSwap(
  tx: Tx,
  offer: {
    id: string;
    employeeId: string;
    proposedShiftId: string | null;
    employee: { displayName: string };
    proposedShift: { startsAt: Date; endsAt: Date } | null;
    request: {
      id: string;
      tenantId: string;
      sessionId: string;
      shift: { startsAt: Date; endsAt: Date };
      requesterName: string;
    };
  },
) {
  const moved = await tx.shiftSwapRequest.updateMany({
    where: { id: offer.request.id, status: 'SEEKING' },
    data: {
      status: 'MATCH_PROPOSED',
      counterpartEmployeeId: offer.employeeId,
      proposedShiftId: offer.proposedShiftId,
    },
  });
  if (moved.count !== 1) {
    await tx.shiftOffer.update({
      where: { id: offer.id },
      data: {
        status: 'QUEUED',
        proposedShiftId: offer.proposedShiftId,
        allowCover: false,
        allowSwap: true,
        respondedAt: new Date(),
      },
    });
    await writeOutbound(tx, offer.request.tenantId, offer.request.sessionId, copy.queuedSwap());
    return { ok: true, queued: true };
  }
  await tx.shiftOffer.update({
    where: { id: offer.id },
    data: { status: 'ACCEPTED', proposedShiftId: offer.proposedShiftId, respondedAt: new Date() },
  });
  await writeOutbound(
    tx,
    offer.request.tenantId,
    offer.request.sessionId,
    copy.swapProposed(
      offer.employee.displayName,
      offer.request.shift.startsAt,
      offer.proposedShift?.startsAt ?? null,
      true,
      offer.request.requesterName,
    ),
  );
  await writePeerNotice(
    tx,
    offer.request.tenantId,
    offer.employeeId,
    copy.swapProposed(
      offer.employee.displayName,
      offer.request.shift.startsAt,
      offer.proposedShift?.startsAt ?? null,
      false,
    ),
    offer.request.id,
  );
  return { ok: true };
}

export async function cancelShiftSearch(sessionId: string) {
  const { tenantId, userId } = requireTenantContext();
  if (!userId) {
    throw new Error('User is required');
  }
  return prisma.$transaction(async (tx) => {
    const request = await tx.shiftSwapRequest.findFirst({
      where: { tenantId, sessionId, employee: { userId } },
    });
    if (!request || !ACTIVE_SEARCH.includes(request.status as (typeof ACTIVE_SEARCH)[number])) {
      throw new Error('Search not found');
    }
    const moved = await tx.shiftSwapRequest.updateMany({
      where: { id: request.id, status: { in: [...ACTIVE_SEARCH] } },
      data: { status: 'CANCELLED', decidedAt: new Date() },
    });
    if (moved.count !== 1) {
      throw new Error(copy.alreadyTaken());
    }
    await closeOpenOffers(tx, {
      requestId: request.id,
      tenantId,
      message: copy.requestCancelled(),
    });
    await writeOutbound(tx, tenantId, sessionId, copy.searchCancelled());
    return { ok: true };
  });
}

export async function closeOffersForDecision(requestId: string, tenantId: string) {
  return prisma.$transaction((tx) =>
    closeOpenOffers(tx, {
      requestId,
      tenantId,
      message: copy.requestCancelled(),
    }),
  );
}

export async function confirmMatch(sessionId: string, action: ShiftMatchAction) {
  const { tenantId, userId } = requireTenantContext();
  if (!userId) {
    throw new Error('User is required');
  }
  return prisma.$transaction(async (tx) => {
    const request = await tx.shiftSwapRequest.findFirst({
      where: { tenantId, sessionId, employee: { userId } },
      include: {
        shift: true,
        employee: true,
        counterpart: true,
        proposedShift: true,
        offers: { include: { employee: true, proposedShift: true } },
      },
    });
    if (!request || request.status !== 'MATCH_PROPOSED' || !request.shift || !request.proposedShift) {
      throw new Error('Match not found');
    }
    if (action === 'accept') {
      const moved = await tx.shiftSwapRequest.updateMany({
        where: { id: request.id, status: 'MATCH_PROPOSED' },
        data: { status: 'COMMITTED', decidedAt: new Date() },
      });
      if (moved.count !== 1) {
        throw new Error(copy.alreadyTaken());
      }
      if (!request.counterpartEmployeeId) {
        throw new Error('Match not found');
      }
      await tx.shift.update({
        where: { id: request.shift.id },
        data: { employeeId: request.counterpartEmployeeId },
      });
      await tx.shift.update({
        where: { id: request.proposedShift.id },
        data: { employeeId: request.employeeId },
      });
      await closeOpenOffers(tx, {
        requestId: request.id,
        tenantId,
        statuses: ['PENDING', 'QUEUED'],
        message: copy.noLongerNeeded(),
      });
      const wanted = wantedLabel(request.shift.startsAt);
      const offered = wantedLabel(request.proposedShift.startsAt);
      await writeOutbound(tx, tenantId, sessionId, copy.swapCommitted(wanted, offered));
      await writePeerNotice(
        tx,
        tenantId,
        request.counterpartEmployeeId,
        copy.swapDonePeer(request.employee.displayName, request.shift.startsAt, request.proposedShift.startsAt),
        request.id,
      );
      return { ok: true };
    }
    await tx.shiftOffer.updateMany({
      where: { requestId: request.id, employeeId: request.counterpartEmployeeId ?? '', status: 'ACCEPTED' },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    await writeOutbound(tx, tenantId, sessionId, copy.requesterRefused());
    return promoteNext(tx, {
      id: request.id,
      tenantId: request.tenantId,
      sessionId: request.sessionId,
      kind: request.kind,
      employeeId: request.employeeId,
      requesterName: request.employee.displayName,
      shift: request.shift,
      offers: request.offers,
    });
  });
}

async function promoteNext(
  tx: Tx,
  request: {
    id: string;
    tenantId: string;
    sessionId: string;
    kind: string;
    employeeId: string;
    requesterName: string;
    shift: { id: string; startsAt: Date; endsAt: Date };
    offers: {
      id: string;
      status: string;
      allowCover: boolean;
      allowSwap: boolean;
      employeeId: string;
      proposedShiftId: string | null;
      employee: { displayName: string };
      proposedShift: { startsAt: Date; endsAt: Date } | null;
    }[];
  },
) {
  const queuedCover = request.offers.find((offer) => offer.status === 'QUEUED' && offer.allowCover);
  if (queuedCover && request.kind === 'EITHER') {
    await tx.shiftSwapRequest.update({
      where: { id: request.id },
      data: {
        status: 'SEEKING',
        counterpartEmployeeId: null,
        proposedShiftId: null,
      },
    });
    return commitCover(tx, {
      id: queuedCover.id,
      employeeId: queuedCover.employeeId,
      employee: queuedCover.employee,
      request: {
        id: request.id,
        tenantId: request.tenantId,
        sessionId: request.sessionId,
        kind: request.kind,
        status: 'SEEKING',
        shift: request.shift,
      },
    });
  }
  const queuedSwap = request.offers.find((offer) => offer.status === 'QUEUED' && offer.allowSwap);
  if (queuedSwap?.proposedShiftId) {
    await tx.shiftSwapRequest.update({
      where: { id: request.id },
      data: {
        status: 'MATCH_PROPOSED',
        counterpartEmployeeId: queuedSwap.employeeId,
        proposedShiftId: queuedSwap.proposedShiftId,
      },
    });
    await tx.shiftOffer.update({
      where: { id: queuedSwap.id },
      data: { status: 'ACCEPTED' },
    });
    await writeOutbound(
      tx,
      request.tenantId,
      request.sessionId,
      copy.swapProposed(
        queuedSwap.employee.displayName,
        request.shift.startsAt,
        queuedSwap.proposedShift?.startsAt ?? null,
        true,
        request.requesterName,
      ),
    );
    return { ok: true };
  }
  const pending = request.offers.some((offer) => offer.status === 'PENDING');
  await tx.shiftSwapRequest.update({
    where: { id: request.id },
    data: {
      status: pending ? 'SEEKING' : 'UNFILLED',
      counterpartEmployeeId: null,
      proposedShiftId: null,
    },
  });
  if (!pending) {
    await writeOutbound(
      tx,
      request.tenantId,
      request.sessionId,
      copy.unfilled(shiftLabelFromStart(request.shift.startsAt)),
    );
  }
  return { ok: true };
}

async function maybeUnfilled(
  tx: Tx,
  request: {
    id: string;
    tenantId: string;
    sessionId: string;
    status: string;
    shift: { startsAt: Date } | null;
  },
) {
  if (request.status !== 'SEEKING') {
    return;
  }
  const open = await tx.shiftOffer.count({
    where: { requestId: request.id, status: { in: ['PENDING', 'QUEUED'] } },
  });
  if (open > 0 || !request.shift) {
    return;
  }
  await tx.shiftSwapRequest.update({
    where: { id: request.id },
    data: { status: 'UNFILLED' },
  });
  await writeOutbound(
    tx,
    request.tenantId,
    request.sessionId,
    copy.unfilled(shiftLabelFromStart(request.shift.startsAt)),
  );
}

async function closeOpenOffers(
  tx: Tx,
  input: {
    requestId: string;
    tenantId: string;
    statuses?: readonly string[];
    message: string;
  },
) {
  const leftovers = await tx.shiftOffer.findMany({
    where: {
      requestId: input.requestId,
      status: { in: [...(input.statuses ?? OPEN_OFFER)] },
    },
    select: { id: true, employeeId: true },
  });
  if (leftovers.length === 0) {
    return;
  }
  await tx.shiftOffer.updateMany({
    where: { id: { in: leftovers.map((row) => row.id) } },
    data: { status: 'CANCELLED', respondedAt: new Date() },
  });
  for (const leftover of leftovers) {
    await writePeerNotice(tx, input.tenantId, leftover.employeeId, input.message, input.requestId);
  }
}

export { ACTIVE_SEARCH };
