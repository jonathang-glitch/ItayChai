import { randomUUID } from 'node:crypto';
import { PERMISSIONS, WHATSAPP_PROVIDER } from '@itay-chai/contracts';
import { runWithTenant } from '@itay-chai/auth';
import {
  classifyWhatsAppText,
  inferRequestKind,
  parseWhatsAppButton,
} from '@itay-chai/domain';
import {
  didNotUnderstand,
  enqueueWhatsAppSendNow,
  findWhatsAppIdentity,
  listIncomingOffers,
  listMyShifts,
  prisma,
  Prisma,
} from '@itay-chai/database';
import { createWhatsAppAdapter } from '@itay-chai/integrations';
import { createCustomerRequest, answerMatch, answerOffer, cancelCustomerSearch } from '../../customer/customer.service';

export type InboundResult = {
  ok: true;
  duplicate?: true;
  ignored?: 'no_message' | 'unknown_sender';
  handled?: 'offer' | 'match' | 'cancel' | 'new_request' | 'unparsed';
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
    const offer = await prisma.shiftOffer.findUnique({
      where: { id: button.offerId },
      select: { request: { select: { sessionId: true } } },
    });
    if (offer) {
      await recordInbound(identity.tenantId, offer.request.sessionId, spoken);
    }
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

  const intent = classifyWhatsAppText(inbound.text);
  const offers = (await listIncomingOffers(identity.userId)).filter((row) => row.status === 'PENDING');
  const pending = offers.length === 1 ? offers[0] : undefined;
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

  if (pending && (intent === 'yes' || intent === 'cover' || intent === 'swap' || intent === 'no')) {
    const action =
      intent === 'no' ? 'decline' : intent === 'swap' || (intent === 'yes' && !pending.allowCover) ? 'swap' : 'cover';
    const proposed = action === 'swap' ? pending.swapChoices?.[0]?.id : undefined;
    await answerOffer(pending.id, action, proposed);
    if (pending.requestedShift) {
      const request = await prisma.shiftSwapRequest.findFirst({
        where: { tenantId: identity.tenantId, shiftId: pending.requestedShift.id },
        select: { sessionId: true },
      });
      if (request) {
        await recordInbound(identity.tenantId, request.sessionId, spoken);
      }
    }
    return { ok: true, handled: 'offer' };
  }

  if (matchSession && (intent === 'accept' || (intent === 'yes' && !pending) || intent === 'decline_match' || (intent === 'no' && !pending))) {
    const action = intent === 'decline_match' || intent === 'no' ? 'decline' : 'accept';
    await answerMatch(matchSession.sessionId, action);
    await recordInbound(identity.tenantId, matchSession.sessionId, spoken);
    return { ok: true, handled: 'match' };
  }

  if (openSearch && intent === 'cancel') {
    await cancelCustomerSearch(openSearch.sessionId);
    await recordInbound(identity.tenantId, openSearch.sessionId, spoken);
    return { ok: true, handled: 'cancel' };
  }

  if (intent === 'cover' || intent === 'swap' || intent === 'either' || intent === 'new') {
    const next = (await listMyShifts(identity.userId))[0];
    if (next) {
      await createCustomerRequest({
        shiftId: next.id,
        kind: inferRequestKind(intent),
        text: inbound.text,
      });
      return { ok: true, handled: 'new_request' };
    }
  }

  await enqueueWhatsAppSendNow({
    tenantId: identity.tenantId,
    userId: identity.userId,
    body: didNotUnderstand(),
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
