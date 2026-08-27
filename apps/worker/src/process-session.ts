import { runWithTenant } from '@itay-chai/auth';
import {
  AGENT_SESSION_REQUESTED,
  RELIABILITY_QUARANTINE_REQUESTED,
  type AgentSessionRequestedPayload,
} from '@itay-chai/contracts';
import { applyTenantRls, prisma, SessionStatus } from '@itay-chai/database';
import { assertTransition, PermanentJobError } from '@itay-chai/domain';
import { MockWhatsAppAdapter } from '@itay-chai/integrations';
import { runReliableJob } from './job-runtime.js';

const FLOW: SessionStatus[] = [
  SessionStatus.INITIALIZING,
  SessionStatus.PLANNING,
  SessionStatus.COMPLETED,
];

const adapter = new MockWhatsAppAdapter();

export async function processAgentSessionJob(raw: unknown): Promise<void> {
  return runReliableJob(raw, processRequestedSession);
}

async function processRequestedSession(raw: unknown): Promise<void> {
  const payload = raw as Omit<AgentSessionRequestedPayload, 'eventType'> & { eventType: string };
  if (payload.eventType === RELIABILITY_QUARANTINE_REQUESTED) {
    throw new PermanentJobError('Job sent to quarantine for a visible failure');
  }
  if (!payload.tenantId) {
    throw new PermanentJobError('Worker job missing tenantId', 'VALIDATION');
  }
  if (payload.eventType !== AGENT_SESSION_REQUESTED) {
    throw new PermanentJobError(`Unsupported event ${String(payload.eventType)}`);
  }

  const session = await prisma.agentSession.findUniqueOrThrow({
    where: { id: payload.sessionId },
  });
  if (session.status === SessionStatus.COMPLETED) {
    return;
  }

  return runWithTenant(
    {
      tenantId: payload.tenantId,
      actorType: 'service',
      permissions: [],
      mfaSatisfied: false,
    },
    async () => {
      await applyTenantRls(payload.tenantId);
      await runFlow(payload as AgentSessionRequestedPayload);
    },
  );
}

async function runFlow(payload: AgentSessionRequestedPayload) {
  for (const next of FLOW) {
    await transition(payload, next);
  }

  const existingOutbound = await prisma.message.findFirst({
    where: { sessionId: payload.sessionId, direction: 'OUTBOUND' },
  });
  if (!existingOutbound) {
    const reply = await adapter.reply();
    await prisma.message.create({
      data: {
        tenantId: payload.tenantId,
        sessionId: payload.sessionId,
        direction: 'OUTBOUND',
        channel: 'whatsapp',
        body: reply.body,
      },
    });
  }
  await prisma.auditEntry.create({
    data: {
      tenantId: payload.tenantId,
      actorType: 'system',
      action: 'session.completed',
      resourceType: 'AgentSession',
      resourceId: payload.sessionId,
      metadata: { eventId: payload.eventId },
    },
  });
}

async function transition(payload: AgentSessionRequestedPayload, toStatus: SessionStatus) {
  const session = await prisma.agentSession.findUniqueOrThrow({
    where: { id: payload.sessionId },
  });
  if (session.status === toStatus || session.status === SessionStatus.COMPLETED) {
    return;
  }

  assertTransition(session.status, toStatus);

  const updated = await prisma.agentSession.updateMany({
    where: { id: session.id, version: session.version },
    data: { status: toStatus, version: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new Error(`CAS failed for session ${session.id} -> ${toStatus}`);
  }

  await prisma.sessionTransition.create({
    data: {
      tenantId: payload.tenantId,
      sessionId: session.id,
      fromStatus: session.status,
      toStatus,
    },
  });
}
