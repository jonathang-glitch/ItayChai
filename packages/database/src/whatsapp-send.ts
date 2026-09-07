import { randomUUID } from 'node:crypto';
import {
  AGENT_SESSION_QUEUE,
  ROLE_NAMES,
  WHATSAPP_PROVIDER,
  WHATSAPP_SEND_REQUESTED,
  type WhatsAppButton,
  type WhatsAppSendRequestedPayload,
} from '@itay-chai/contracts';
import { normalizeWhatsAppId } from '@itay-chai/domain';
import { prisma } from './index.js';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

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
  },
) {
  const identity = await tx.stakeholderIdentity.findFirst({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      channel: WHATSAPP_PROVIDER,
    },
  });
  if (!identity) {
    return null;
  }

  const correlationId = input.correlationId ?? randomUUID();
  const event = await tx.domainEvent.create({
    data: {
      tenantId: input.tenantId,
      eventType: WHATSAPP_SEND_REQUESTED,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      aggregateVersion: 0,
      payload: {
        to: identity.externalId,
        text: input.body,
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
    text: input.body,
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
  },
) {
  return prisma.$transaction((tx) => enqueueWhatsAppSend(tx, input));
}

export async function enqueueOwnerWhatsApp(
  tx: Tx,
  tenantId: string,
  body: string,
  aggregateId: string,
) {
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
