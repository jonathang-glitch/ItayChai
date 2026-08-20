import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AGENT_SESSION_QUEUE,
  AGENT_SESSION_REQUESTED,
  RELIABILITY_QUARANTINE_REQUESTED,
} from '@itay-chai/contracts';
import { prisma } from '@itay-chai/database';

export async function listOpenDlq(tenantId: string) {
  return prisma.dlqItem.findMany({
    where: { tenantId, status: 'OPEN' },
    include: { replays: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createVisibleFailure(tenantId: string) {
  const correlationId = randomUUID();
  return prisma.$transaction(async (tx) => {
    const session = await tx.agentSession.create({
      data: {
        tenantId,
        status: 'DRAFT',
        version: 0,
        externalMessageId: `fail-${Date.now()}`,
      },
    });
    const event = await tx.domainEvent.create({
      data: {
        tenantId,
        eventType: RELIABILITY_QUARANTINE_REQUESTED,
        aggregateType: 'AgentSession',
        aggregateId: session.id,
        aggregateVersion: 0,
        payload: { reason: 'visible-failure' },
        correlationId,
      },
    });
    await tx.outboxMessage.create({
      data: {
        tenantId,
        eventId: event.id,
        destination: AGENT_SESSION_QUEUE,
        payload: {
          eventType: RELIABILITY_QUARANTINE_REQUESTED,
          tenantId,
          sessionId: session.id,
          eventId: event.id,
          correlationId,
          externalMessageId: session.externalMessageId,
        },
      },
    });
    await tx.auditEntry.create({
      data: {
        tenantId,
        actorType: 'ops',
        action: 'reliability.failure_injected',
        resourceType: 'AgentSession',
        resourceId: session.id,
        metadata: { eventId: event.id },
      },
    });
    return { sessionId: session.id, eventId: event.id };
  });
}

export async function replayDlq(input: {
  tenantId: string;
  dlqItemId: string;
  userId: string;
  reason: string;
}) {
  const item = await prisma.dlqItem.findFirst({
    where: { id: input.dlqItemId, tenantId: input.tenantId },
  });
  if (!item) {
    throw new NotFoundException('DLQ item not found');
  }
  if (item.status !== 'OPEN') {
    throw new BadRequestException('DLQ item already replayed');
  }

  const original = item.payload as {
    sessionId?: string;
    externalMessageId?: string;
    correlationId?: string;
  };
  if (!original.sessionId) {
    throw new BadRequestException('DLQ payload is missing sessionId');
  }

  const correlationId = original.correlationId ?? randomUUID();
  const replayId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const event = await tx.domainEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: AGENT_SESSION_REQUESTED,
        aggregateType: 'AgentSession',
        aggregateId: original.sessionId ?? replayId,
        aggregateVersion: 0,
        payload: { replayOf: item.id },
        correlationId,
        causationId: item.eventId,
      },
    });
    await tx.outboxMessage.create({
      data: {
        tenantId: input.tenantId,
        eventId: event.id,
        destination: item.destination || AGENT_SESSION_QUEUE,
        payload: {
          eventType: AGENT_SESSION_REQUESTED,
          tenantId: input.tenantId,
          sessionId: original.sessionId,
          eventId: event.id,
          correlationId,
          externalMessageId: original.externalMessageId ?? `replay-${replayId}`,
        },
      },
    });
    await tx.dlqReplay.create({
      data: {
        tenantId: input.tenantId,
        dlqItemId: item.id,
        replayedBy: input.userId,
        reason: input.reason,
      },
    });
    await tx.dlqItem.update({
      where: { id: item.id },
      data: { status: 'REPLAYED' },
    });
    await tx.auditEntry.create({
      data: {
        tenantId: input.tenantId,
        actorType: 'ops',
        action: 'dlq.replayed',
        resourceType: 'DlqItem',
        resourceId: item.id,
        metadata: { reason: input.reason, replayEventId: event.id, sessionId: original.sessionId },
      },
    });
  });

  return { ok: true, sessionId: original.sessionId };
}
