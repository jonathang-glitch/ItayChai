import { randomUUID } from 'node:crypto';
import { PERMISSIONS, WHATSAPP_PROVIDER } from '@itay-chai/contracts';
import { runWithTenant } from '@itay-chai/auth';
import {
  answerDeskQuestion,
  classifyMatchReply,
  classifyWhatsAppText,
  inferRequestKind,
  isDeskQuestion,
  isSandboxJoin,
  matchShiftFromText,
  parseWhatsAppButton,
  shouldClassifyWithGemini,
} from '@itay-chai/domain';
import {
  enqueueWhatsAppSendNow,
  howToStart,
  whatElse,
  findWhatsAppIdentity,
  getDeskAsk,
  listIncomingOffers,
  listMyShifts,
  myShifts,
  pickSwapAgain,
  pickWhichShift,
  prisma,
  Prisma,
  shiftTalkWithDate,
} from '@itay-chai/database';
import { createWhatsAppAdapter } from '@itay-chai/integrations';
import { createCustomerRequest, answerMatch, answerOffer, cancelCustomerSearch } from '../../customer/customer.service';
import { applyGeminiIntent } from './apply-gemini';
import { choosePendingOffer } from './pick-pending-offer';

export type InboundResult = {
  ok: true;
  duplicate?: true;
  ignored?: 'no_message' | 'unknown_sender';
  handled?: 'offer' | 'match' | 'cancel' | 'new_request' | 'unparsed' | 'need_pick' | 'roster';
  error?: string;
};

const adapter = createWhatsAppAdapter();

async function recordInbound(tenantId: string, sessionId: string, body: string) {
  await prisma.message.create({
    data: {
      tenantId,
      sessionId,
      direction: 'INBOUND',
      channel: WHATSAPP_PROVIDER,
      body,
    },
  });
}

async function recordSpeaker(tenantId: string, userId: string, body: string) {
  const recent = await prisma.message.findFirst({
    where: {
      tenantId,
      direction: 'INBOUND',
      body,
      session: { customerUserId: userId },
      createdAt: { gt: new Date(Date.now() - 5000) },
    },
    select: { id: true },
  });
  if (recent) {
    return;
  }
  const session = await prisma.agentSession.findFirst({
    where: { tenantId, customerUserId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!session) {
    return;
  }
  await recordInbound(tenantId, session.id, body);
}

async function lockReceipt(tenantId: string, externalMessageId: string) {
  try {
    await prisma.$transaction([
      prisma.webhookReceipt.create({
        data: { tenantId, provider: WHATSAPP_PROVIDER, externalMessageId },
      }),
      prisma.inboxMessage.create({
        data: { tenantId, provider: WHATSAPP_PROVIDER, externalMessageId },
      }),
    ]);
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

async function routeIdentified(
  identity: { tenantId: string; userId: string },
  inbound: { text?: string; buttonId?: string; externalMessageId: string },
): Promise<InboundResult> {
  const spoken = inbound.text?.trim() || inbound.buttonId || '';
  const button = parseWhatsAppButton(inbound.buttonId);
  if (button?.kind === 'offer') {
    await answerOffer(button.offerId, button.action, button.proposedShiftId);
    await recordSpeaker(identity.tenantId, identity.userId, spoken);
    return { ok: true, handled: 'offer' };
  }
  if (button?.kind === 'match') {
    await answerMatch(button.sessionId, button.action);
    await recordInbound(identity.tenantId, button.sessionId, spoken);
    return { ok: true, handled: 'match' };
  }
  if (button?.kind === 'cancel') {
    await cancelCustomerSearch(button.sessionId);
    await recordInbound(identity.tenantId, button.sessionId, spoken);
    return { ok: true, handled: 'cancel' };
  }

  if (isSandboxJoin(inbound.text)) {
    return { ok: true, handled: 'unparsed' };
  }

  const intent = classifyWhatsAppText(inbound.text);
  const offers = (await listIncomingOffers(identity.userId)).filter((row) => row.status === 'PENDING');
  const choice = choosePendingOffer(offers, spoken, intent);
  const pending = choice.offer;
  const matchSession = await prisma.shiftSwapRequest.findFirst({
    where: {
      tenantId: identity.tenantId,
      status: 'MATCH_PROPOSED',
      employee: { userId: identity.userId },
    },
    select: { sessionId: true },
  });
  const openSearch = await prisma.shiftSwapRequest.findFirst({
    where: {
      tenantId: identity.tenantId,
      status: { in: ['SEEKING', 'MATCH_PROPOSED'] },
      employee: { userId: identity.userId },
    },
    select: { sessionId: true },
  });

  const namedShift = pending
    ? matchShiftFromText(inbound.text, [...(pending.swapChoices ?? []), ...(pending.weekShifts ?? [])])
    : undefined;
  const matchReply = matchSession ? classifyMatchReply(inbound.text) : 'unknown';
  const agrees = matchReply === 'accept' || intent === 'accept';
  const refuses = matchReply === 'decline' || intent === 'decline_match';
  const ask = await getDeskAsk(identity.tenantId, identity.userId);

  if (isDeskQuestion(inbound.text)) {
    const mine = await listMyShifts(identity.userId);
    const upcoming = mine.filter((shift) => new Date(shift.endsAt).getTime() > Date.now());
    const mineLabels = (upcoming.length ? upcoming : mine).map((shift) =>
      shift.startsAt ? shiftTalkWithDate(new Date(shift.startsAt)) : shift.label,
    );
    const me = await prisma.employee.findFirst({
      where: { tenantId: identity.tenantId, userId: identity.userId },
      select: { id: true, businessUnitId: true },
    });
    const people = me
      ? await prisma.employee.findMany({
          where: { tenantId: identity.tenantId, businessUnitId: me.businessUnitId, id: { not: me.id } },
          select: {
            displayName: true,
            shifts: {
              where: { endsAt: { gt: new Date() } },
              orderBy: { startsAt: 'asc' },
              select: { startsAt: true },
            },
          },
        })
      : [];
    const search = me
      ? await prisma.shiftSwapRequest.findFirst({
          where: { tenantId: identity.tenantId, employeeId: me.id, status: { in: ['SEEKING', 'MATCH_PROPOSED', 'UNFILLED'] } },
          orderBy: { createdAt: 'desc' },
          select: { kind: true, status: true, shift: { select: { startsAt: true } } },
        })
      : null;
    const wanted = pending?.requestedShift?.startsAt
      ? shiftTalkWithDate(new Date(pending.requestedShift.startsAt))
      : '';
    await enqueueWhatsAppSendNow({
      tenantId: identity.tenantId,
      userId: identity.userId,
      body: answerDeskQuestion(spoken, {
        pending:
          pending && wanted
            ? {
                name: pending.requesterName,
                label: wanted,
                allowCover: pending.allowCover,
                allowSwap: pending.allowSwap,
              }
            : null,
        mine: mineLabels,
        team: people.map((person) => ({
          name: person.displayName,
          shifts: person.shifts.map((shift) => shiftTalkWithDate(shift.startsAt)),
        })),
        search: search?.shift
          ? { kind: search.kind, label: shiftTalkWithDate(search.shift.startsAt), status: search.status }
          : null,
      }),
      aggregateType: 'WhatsAppInbound',
      aggregateId: pending?.id ?? randomUUID(),
      deskAsk: 'none',
    });
    return { ok: true, handled: 'unparsed' };
  }

  if (choice.ask) {
    await enqueueWhatsAppSendNow({
      tenantId: identity.tenantId,
      userId: identity.userId,
      body: choice.ask,
      aggregateType: 'WhatsAppInbound',
      aggregateId: pending?.id ?? randomUUID(),
      deskAsk: 'none',
    });
    return { ok: true, handled: 'need_pick' };
  }

  const tryGemini = async () => {
    if (!shouldClassifyWithGemini(inbound.text, intent)) {
      return null;
    }
    return applyGeminiIntent({
      tenantId: identity.tenantId,
      userId: identity.userId,
      text: spoken,
      pending,
      matchSessionId: matchSession?.sessionId,
      openSearchId: openSearch?.sessionId,
    });
  };
  try {
    const gemini = await tryGemini();
    if (gemini) {
      return gemini;
    }
  } catch (error) {
    console.warn('gemini_route_failed', error instanceof Error ? error.message : 'error');
  }
  if (intent === 'hello') {
    await enqueueWhatsAppSendNow({
      tenantId: identity.tenantId,
      userId: identity.userId,
      body: howToStart(),
      aggregateType: 'WhatsAppInbound',
      aggregateId: randomUUID(),
      deskAsk: 'none',
    });
    return { ok: true, handled: 'unparsed' };
  }
  if (matchSession && ask === 'confirm_swap' && (agrees || refuses) && !namedShift) {
    await answerMatch(matchSession.sessionId, refuses && matchReply !== 'accept' ? 'decline' : 'accept');
    await recordInbound(identity.tenantId, matchSession.sessionId, spoken);
    if (matchReply === 'decline' || intent === 'help') {
      await enqueueWhatsAppSendNow({
        tenantId: identity.tenantId,
        userId: identity.userId,
        body: whatElse(),
        aggregateType: 'WhatsAppInbound',
        aggregateId: matchSession.sessionId,
      });
    }
    return { ok: true, handled: 'match' };
  }
  if (pending && namedShift && intent !== 'cancel') {
    await answerOffer(pending.id, 'swap', namedShift);
    await recordSpeaker(identity.tenantId, identity.userId, spoken);
    return { ok: true, handled: 'offer' };
  }
  if (pending && (intent === 'no' || intent === 'decline_match' || matchReply === 'decline')) {
    await answerOffer(pending.id, 'decline');
    await recordSpeaker(identity.tenantId, identity.userId, spoken);
    return { ok: true, handled: 'offer' };
  }
  if (pending && (intent === 'yes' || intent === 'cover' || intent === 'swap' || intent === 'either')) {
    const onlyCover = pending.allowCover && !pending.allowSwap;
    const both = pending.allowCover && pending.allowSwap;
    if (intent === 'cover' || (intent === 'yes' && onlyCover)) {
      await answerOffer(pending.id, 'cover');
      await recordSpeaker(identity.tenantId, identity.userId, spoken);
      return { ok: true, handled: 'offer' };
    }
    if ((intent === 'yes' || intent === 'either') && both) {
      await enqueueWhatsAppSendNow({
        tenantId: identity.tenantId,
        userId: identity.userId,
        body: 'כיסוי, החלפה, או שניהם?',
        aggregateType: 'WhatsAppInbound',
        aggregateId: pending.id,
        deskAsk: 'none',
      });
      return { ok: true, handled: 'need_pick' };
    }
    const onlyChoice = pending.swapChoices?.length === 1 ? pending.swapChoices[0]?.id : undefined;
    const proposed = namedShift ?? onlyChoice;
    if (!proposed) {
      const labels = (pending.swapChoices ?? []).map((shift) =>
        shift.startsAt ? shiftTalkWithDate(new Date(shift.startsAt)) : shift.label,
      );
      await enqueueWhatsAppSendNow({
        tenantId: identity.tenantId,
        userId: identity.userId,
        body: pickSwapAgain(labels),
        aggregateType: 'WhatsAppInbound',
        aggregateId: pending.id,
      });
      return { ok: true, handled: 'need_pick' };
    }
    await answerOffer(pending.id, 'swap', proposed);
    await recordSpeaker(identity.tenantId, identity.userId, spoken);
    return { ok: true, handled: 'offer' };
  }

  if (intent === 'help') {
    await enqueueWhatsAppSendNow({
      tenantId: identity.tenantId,
      userId: identity.userId,
      body: whatElse(),
      aggregateType: 'WhatsAppInbound',
      aggregateId: randomUUID(),
    });
    return { ok: true, handled: 'unparsed' };
  }

  if (openSearch && intent === 'cancel') {
    await cancelCustomerSearch(openSearch.sessionId);
    await recordInbound(identity.tenantId, openSearch.sessionId, spoken);
    return { ok: true, handled: 'cancel' };
  }

  const mine = await listMyShifts(identity.userId);
  if (intent === 'roster') {
    const upcoming = mine.filter((shift) => new Date(shift.endsAt).getTime() > Date.now());
    const labels = (upcoming.length ? upcoming : mine).map((shift) =>
      shift.startsAt ? shiftTalkWithDate(new Date(shift.startsAt)) : shift.label,
    );
    await enqueueWhatsAppSendNow({
      tenantId: identity.tenantId,
      userId: identity.userId,
      body: myShifts(labels),
      aggregateType: 'WhatsAppInbound',
      aggregateId: randomUUID(),
    });
    return { ok: true, handled: 'roster' };
  }
  const wantsNew = intent === 'cover' || intent === 'swap' || intent === 'either' || intent === 'new';
  const upcomingMine = mine.filter((shift) => new Date(shift.endsAt).getTime() > Date.now());
  const namedMine =
    matchShiftFromText(inbound.text, mine) ??
    (wantsNew && upcomingMine.length === 1 ? upcomingMine[0]?.id : undefined);
  if (!namedMine && wantsNew) {
    const upcoming = mine.filter((shift) => new Date(shift.endsAt).getTime() > Date.now());
    const choices = (upcoming.length ? upcoming : mine).map((shift) =>
      shift.startsAt ? shiftTalkWithDate(new Date(shift.startsAt)) : shift.label,
    );
    if (choices.length) {
      await enqueueWhatsAppSendNow({
        tenantId: identity.tenantId,
        userId: identity.userId,
        body: intent === 'swap' ? pickSwapAgain(choices) : pickWhichShift(choices),
        aggregateType: 'WhatsAppInbound',
        aggregateId: randomUUID(),
      });
      return { ok: true, handled: 'need_pick' };
    }
  }
  const chosen = namedMine ? mine.find((shift) => shift.id === namedMine) : undefined;
  const pickedKind =
    ask === 'pick_cover' ? 'COVER' : ask === 'pick_swap' ? 'SWAP' : ask === 'pick_either' ? 'EITHER' : undefined;
  if (chosen && (wantsNew || pickedKind)) {
    await createCustomerRequest({
      shiftId: chosen.id,
      kind: pickedKind ?? inferRequestKind(intent),
      text: inbound.text,
    });
    return { ok: true, handled: 'new_request' };
  }

  try {
    const gemini = await applyGeminiIntent({
      tenantId: identity.tenantId,
      userId: identity.userId,
      text: spoken,
      pending,
      matchSessionId: matchSession?.sessionId,
      openSearchId: openSearch?.sessionId,
    });
    if (gemini) {
      return gemini;
    }
  } catch (error) {
    console.warn('gemini_route_failed', error instanceof Error ? error.message : 'error');
  }

  await enqueueWhatsAppSendNow({
    tenantId: identity.tenantId,
    userId: identity.userId,
    body: howToStart(),
    aggregateType: 'WhatsAppInbound',
    aggregateId: randomUUID(),
  });
  return { ok: true, handled: 'unparsed' };
}

export async function handleWhatsAppInbound(payload: unknown): Promise<InboundResult> {
  const inbound = adapter.parseInbound(payload);
  if (!inbound) {
    return { ok: true, ignored: 'no_message' };
  }
  const existing = await prisma.webhookReceipt.findFirst({
    where: { provider: WHATSAPP_PROVIDER, externalMessageId: inbound.externalMessageId },
  });
  if (existing) {
    return { ok: true, duplicate: true };
  }
  const identity = await findWhatsAppIdentity(inbound.from);
  if (!identity?.userId) {
    return { ok: true, ignored: 'unknown_sender' };
  }
  const userId = identity.userId;
  if (!(await lockReceipt(identity.tenantId, inbound.externalMessageId))) {
    return { ok: true, duplicate: true };
  }
  await prisma.auditEntry.create({
    data: {
      tenantId: identity.tenantId,
      actorType: 'system',
      action: 'whatsapp.inbound',
      resourceType: 'StakeholderIdentity',
      resourceId: identity.id,
      metadata: { from: inbound.from, externalMessageId: inbound.externalMessageId },
    },
  });
  try {
    return await runWithTenant(
      {
        tenantId: identity.tenantId,
        userId,
        actorType: 'user',
        permissions: [PERMISSIONS.CUSTOMER_WRITE],
        mfaSatisfied: false,
      },
      () => routeIdentified({ tenantId: identity.tenantId, userId }, inbound),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'inbound failed';
    await prisma.auditEntry.create({
      data: {
        tenantId: identity.tenantId,
        actorType: 'system',
        action: 'whatsapp.inbound_failed',
        resourceType: 'StakeholderIdentity',
        resourceId: identity.id,
        metadata: { message, externalMessageId: inbound.externalMessageId },
      },
    });
    return { ok: true, error: message };
  }
}
