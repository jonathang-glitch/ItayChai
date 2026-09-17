import { randomUUID } from 'node:crypto';
import { classifyShiftTextWithGemini, geminiShiftConfigured } from '@itay-chai/integrations';
// Gemini uses gemini-3.6-flash for AQ auth keys.
import {
  enqueueWhatsAppSendNow,
  listMyShifts,
  myShifts,
  pickSwapAgain,
  prisma,
  shiftTalkWithDate,
} from '@itay-chai/database';
import { createCustomerRequest, answerMatch, answerOffer, cancelCustomerSearch } from '../../customer/customer.service';

type Routed = {
  ok: true;
  handled?: 'offer' | 'match' | 'cancel' | 'new_request' | 'unparsed' | 'need_pick' | 'roster';
};

type PendingOffer = {
  id: string;
  allowCover: boolean;
  allowSwap: boolean;
  swapChoices?: { id: string }[];
};

export async function applyGeminiIntent(input: {
  tenantId: string;
  userId: string;
  text: string;
  pending?: PendingOffer;
  matchSessionId?: string;
  openSearchId?: string;
}): Promise<Routed | null> {
  if (!geminiShiftConfigured()) {
    return null;
  }
  const mine = await listMyShifts(input.userId);
  const shifts = mine.map((shift) => ({
    id: shift.id,
    label: shift.startsAt ? shiftTalkWithDate(new Date(shift.startsAt)) : shift.label,
  }));
  const recentRows = await prisma.message.findMany({
    where: { tenantId: input.tenantId, session: { customerUserId: input.userId } },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { direction: true, body: true },
  });
  const decision = await classifyShiftTextWithGemini({
    text: input.text,
    shifts,
    waitingConfirm: Boolean(input.matchSessionId),
    openSearch: Boolean(input.openSearchId),
    recent: recentRows.reverse().map((row) => ({
      from: row.direction === 'INBOUND' ? 'user' : 'bot',
      text: row.body.slice(0, 160),
    })),
    ...(input.pending
      ? {
          pendingOffer: {
            allowCover: input.pending.allowCover,
            allowSwap: input.pending.allowSwap,
            swapShiftIds: (input.pending.swapChoices ?? []).map((shift) => shift.id),
          },
        }
      : {}),
  });
  if (!decision) {
    return null;
  }

  const upcoming = mine.filter((shift) => new Date(shift.endsAt).getTime() > Date.now());
  const soleShiftId = upcoming.length === 1 ? upcoming[0]?.id : undefined;
  const shiftId = decision.shiftId ?? soleShiftId;
  const startAction =
    decision.action === 'need_pick' && soleShiftId
      ? 'start_cover'
      : decision.action;

  const send = (body: string) =>
    enqueueWhatsAppSendNow({
      tenantId: input.tenantId,
      userId: input.userId,
      body,
      aggregateType: 'WhatsAppInbound',
      aggregateId: randomUUID(),
    });

  if (decision.action === 'show_roster') {
    const upcoming = mine.filter((shift) => new Date(shift.endsAt).getTime() > Date.now());
    const labels = (upcoming.length ? upcoming : mine).map((shift) =>
      shift.startsAt ? shiftTalkWithDate(new Date(shift.startsAt)) : shift.label,
    );
    await send(decision.reply || myShifts(labels));
    return { ok: true, handled: 'roster' };
  }
  if (decision.action === 'accept_match' && input.matchSessionId) {
    await answerMatch(input.matchSessionId, 'accept');
    return { ok: true, handled: 'match' };
  }
  if (decision.action === 'decline_match' && input.matchSessionId) {
    await answerMatch(input.matchSessionId, 'decline');
    return { ok: true, handled: 'match' };
  }
  if (decision.action === 'cancel_search' && input.openSearchId) {
    await cancelCustomerSearch(input.openSearchId);
    return { ok: true, handled: 'cancel' };
  }
  if (input.pending && decision.action === 'decline_offer') {
    await answerOffer(input.pending.id, 'decline');
    return { ok: true, handled: 'offer' };
  }
  if (input.pending && decision.action === 'accept_cover' && input.pending.allowCover) {
    await answerOffer(input.pending.id, 'cover');
    return { ok: true, handled: 'offer' };
  }
  if (input.pending && (decision.action === 'accept_swap' || decision.action === 'start_swap')) {
    const proposed =
      decision.shiftId ??
      (input.pending.swapChoices?.length === 1 ? input.pending.swapChoices[0]?.id : undefined);
    if (!proposed) {
      await send(decision.reply || pickSwapAgain(shifts.map((shift) => shift.label)));
      return { ok: true, handled: 'need_pick' };
    }
    await answerOffer(input.pending.id, 'swap', proposed);
    return { ok: true, handled: 'offer' };
  }

  const kind =
    startAction === 'start_cover' ? 'COVER' : startAction === 'start_either' ? 'EITHER' : 'SWAP';
  if (startAction === 'start_cover' || startAction === 'start_swap' || startAction === 'start_either') {
    if (!shiftId) {
      await send(decision.reply || pickSwapAgain(shifts.map((shift) => shift.label)));
      return { ok: true, handled: 'need_pick' };
    }
    await createCustomerRequest({ shiftId, kind, text: input.text });
    return { ok: true, handled: 'new_request' };
  }

  if (decision.action === 'need_pick' || decision.action === 'clarify') {
    await send(decision.reply || pickSwapAgain(shifts.map((shift) => shift.label)));
    return { ok: true, handled: decision.action === 'need_pick' ? 'need_pick' : 'unparsed' };
  }
  return null;
}
