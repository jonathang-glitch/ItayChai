import { requireTenantContext } from '@itay-chai/auth';
import { withTenantDb } from './tenant-db.js';

export async function findSessionsForTenant() {
  const { tenantId } = requireTenantContext();
  return withTenantDb(tenantId, (tx) =>
    tx.agentSession.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

export async function findSessionForTenant(sessionId: string) {
  const { tenantId } = requireTenantContext();
  return withTenantDb(tenantId, (tx) =>
    tx.agentSession.findFirst({
      where: { tenantId, id: sessionId },
    }),
  );
}

export async function acknowledgeSession(sessionId: string) {
  const context = requireTenantContext();
  return withTenantDb(context.tenantId, async (tx) => {
    const session = await tx.agentSession.findFirst({
      where: { tenantId: context.tenantId, id: sessionId },
    });
    if (!session) {
      return null;
    }
    await tx.auditEntry.create({
      data: {
        tenantId: context.tenantId,
        actorType: context.actorType,
        action: 'session.acknowledged',
        resourceType: 'AgentSession',
        resourceId: session.id,
        metadata: { userId: context.userId ?? null },
      },
    });
    return session;
  });
}
