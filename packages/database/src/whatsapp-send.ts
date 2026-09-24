import { randomUUID } from 'node:crypto';
import {
  AGENT_SESSION_QUEUE,
  MOCK_WHATSAPP_REPLY,
  ROLE_NAMES,
  WHATSAPP_PROVIDER,
  WHATSAPP_SEND_REQUESTED,
  type WhatsAppButton,
  type WhatsAppSendRequestedPayload,
} from '@itay-chai/contracts';
import { deskAskFromLastBot, normalizeWhatsAppId, type DeskAsk } from '@itay-chai/domain';
import { prisma } from './index.js';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

const PLACEHOLDER_WHATSAPP = /^\+97250000000\d$/;

function isLiveTwilio() {
  return (process.env.WHATSAPP_PROVIDER ?? 'mock') === 'twilio';
}

function siteWhatsAppText(body: string) {
  return body === 'Your request was received.' ? MOCK_WHATSAPP_REPLY : body;
}

function skipPlaceholderOnTwilio(phone: string) {
  return (
    (process.env.WHATSAPP_PROVIDER ?? 'mock') === 'twilio' &&
    PLACEHOLDER_WHATSAPP.test(normalizeWhatsAppId(phone))
  );
}

export async function findWhatsAppIdentity(from: string) {
  const normalized = normalizeWhatsAppId(from);
  const candidates = [...new Set([from.trim(), normalized, normalized.replace(/^\+/, '')])];
  return prisma.stakeholderIdentity.findFirst({
    where: { channel: WHATSAPP_PROVIDER, externalId: { in: candidates } },
  });
}

export async function enqueueWhatsAppSend(
  tx: Tx,
  input: {
    tenantId: string;
    userId: string;
    body: string;
    aggregateType: string;
    aggregateId: string;
    correlationId?: string;
    buttons?: WhatsAppButton[];
    deskAsk?: DeskAsk;
  },
) {
  if (input.deskAsk) {
    await tx.employee.updateMany({
      where: { tenantId: input.tenantId, userId: input.userId },
      data: { deskAsk: input.deskAsk },
    });
  }
  const identity = await tx.stakeholderIdentity.findFirst({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      channel: WHATSAPP_PROVIDER,
    },
  });
  if (!identity || skipPlaceholderOnTwilio(identity.externalId)) {
    return null;
  }

  const correlationId = input.correlationId ?? randomUUID();
  const text = siteWhatsAppText(input.body);
  const event = await tx.domainEvent.create({
    data: {
      tenantId: input.tenantId,
      eventType: WHATSAPP_SEND_REQUESTED,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      aggregateVersion: 0,
      payload: {
        to: identity.externalId,
        text,
        userId: input.userId,
        ...(input.buttons ? { buttons: input.buttons } : {}),
      },
      correlationId,
    },
  });

  const payload: WhatsAppSendRequestedPayload = {
    eventType: WHATSAPP_SEND_REQUESTED,
    tenantId: input.tenantId,
    eventId: event.id,
    correlationId,
    userId: input.userId,
    to: identity.externalId,
    text,
    ...(input.buttons ? { buttons: input.buttons } : {}),
  };

  await tx.outboxMessage.create({
    data: {
      tenantId: input.tenantId,
      eventId: event.id,
      destination: AGENT_SESSION_QUEUE,
      payload,
    },
  });

  return event.id;
}

export async function enqueueWhatsAppSendNow(
  input: {
    tenantId: string;
    userId: string;
    body: string;
    aggregateType: string;
    aggregateId: string;
    buttons?: WhatsAppButton[];
    deskAsk?: DeskAsk;
  },
) {
  return prisma.$transaction((tx) => enqueueWhatsAppSend(tx, input));
}

export async function getDeskAsk(tenantId: string, userId: string) {
  const row = await prisma.employee.findFirst({
    where: { tenantId, userId },
    select: { deskAsk: true },
  });
  if (
    row?.deskAsk === 'confirm_swap' ||
    row?.deskAsk === 'pick_cover' ||
    row?.deskAsk === 'pick_swap' ||
    row?.deskAsk === 'pick_either' ||
    row?.deskAsk === 'none'
  ) {
    return row.deskAsk;
  }
  const last = await prisma.message.findFirst({
    where: { tenantId, direction: 'OUTBOUND', session: { customerUserId: userId } },
    orderBy: { createdAt: 'desc' },
    select: { body: true },
  });
  return deskAskFromLastBot(last?.body);
}

export async function enqueueOwnerWhatsApp(
  tx: Tx,
  tenantId: string,
  body: string,
  aggregateId: string,
) {
  if (isLiveTwilio()) {
    return null;
  }
  const owner = await tx.tenantMembership.findFirst({
    where: { tenantId, status: 'ACTIVE', role: { name: ROLE_NAMES.OWNER } },
    select: { userId: true },
  });
  if (!owner) {
    return null;
  }
  return enqueueWhatsAppSend(tx, {
    tenantId,
    userId: owner.userId,
    body,
    aggregateType: 'OwnerNotice',
    aggregateId,
  });
}
