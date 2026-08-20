import { randomUUID } from 'node:crypto';
import {
  AGENT_SESSION_QUEUE,
  AGENT_SESSION_REQUESTED,
  DEV_TENANT_ID,
  MOCK_WHATSAPP_REPLY,
  WHATSAPP_PROVIDER,
  type AgentSessionRequestedPayload,
  type MockWhatsAppWebhook,
} from '@itay-chai/contracts';
import { Prisma, prisma } from '@itay-chai/database';

export type IngestResult = {
  sessionId: string;
  message: string;
};

export async function ingestMockWhatsApp(input: MockWhatsAppWebhook): Promise<IngestResult> {
  const existing = await findExisting(input.externalMessageId);
  if (existing) {
    return existing;
  }

  try {
    return await createNew(input);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await findExisting(input.externalMessageId);
      if (duplicate) {
        return duplicate;
      }
    }
    throw error;
  }
}

async function findExisting(externalMessageId: string): Promise<IngestResult | null> {
  const receipt = await prisma.webhookReceipt.findFirst({
    where: { provider: WHATSAPP_PROVIDER, externalMessageId },
  });
  if (!receipt) {
    return null;
  }

  const session = await prisma.agentSession.findFirst({
    where: { tenantId: receipt.tenantId, externalMessageId },
  });
  if (!session) {
    throw new Error(`Webhook receipt ${receipt.id} has no session`);
  }

  return { sessionId: session.id, message: MOCK_WHATSAPP_REPLY };
}

async function createNew(input: MockWhatsAppWebhook): Promise<IngestResult> {
  const tenantId = DEV_TENANT_ID;
  const correlationId = randomUUID();

  return prisma.$transaction(async (tx) => {
    await tx.webhookReceipt.create({
      data: {
        tenantId,
        provider: WHATSAPP_PROVIDER,
        externalMessageId: input.externalMessageId,
      },
    });
    await tx.inboxMessage.create({
      data: {
        tenantId,
        provider: WHATSAPP_PROVIDER,
        externalMessageId: input.externalMessageId,
      },
    });

    const session = await tx.agentSession.create({
      data: {
        tenantId,
        status: 'DRAFT',
        version: 0,
        externalMessageId: input.externalMessageId,
      },
    });

    await tx.message.create({
      data: {
        tenantId,
        sessionId: session.id,
        direction: 'INBOUND',
        channel: WHATSAPP_PROVIDER,
        body: input.text ?? '',
      },
    });

    const event = await tx.domainEvent.create({
      data: {
        tenantId,
        eventType: AGENT_SESSION_REQUESTED,
        aggregateType: 'AgentSession',
        aggregateId: session.id,
        aggregateVersion: 0,
        payload: { externalMessageId: input.externalMessageId },
        correlationId,
      },
    });

    const payload: AgentSessionRequestedPayload = {
      eventType: AGENT_SESSION_REQUESTED,
      tenantId,
      sessionId: session.id,
      eventId: event.id,
      correlationId,
      externalMessageId: input.externalMessageId,
    };

    await tx.outboxMessage.create({
      data: {
        tenantId,
        eventId: event.id,
        destination: AGENT_SESSION_QUEUE,
        payload,
      },
    });

    await tx.auditEntry.create({
      data: {
        tenantId,
        actorType: 'system',
        action: 'webhook.received',
        resourceType: 'AgentSession',
        resourceId: session.id,
        metadata: { provider: WHATSAPP_PROVIDER, externalMessageId: input.externalMessageId },
      },
    });

    return { sessionId: session.id, message: MOCK_WHATSAPP_REPLY };
  });
}
