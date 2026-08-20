import { requireTenantContext } from '@itay-chai/auth';
import { customerRequestPrefix } from '@itay-chai/contracts';
import { prisma } from './index.js';
import { presentShiftRequest } from './shifts.js';
import { withTenantDb } from './tenant-db.js';

const sessionWithMessages = {
  messages: { orderBy: { createdAt: 'asc' as const } },
  customer: { select: { id: true, name: true, email: true } },
  shiftRequest: { include: { shift: true, employee: true } },
};

export function presentSession<
  T extends {
    id: string;
    status: string;
    tenantId: string;
    createdAt: Date;
    customerUserId?: string | null;
    customer?: { id: string; name: string | null; email: string | null } | null;
    messages: { id: string; direction: string; body: string; createdAt: Date }[];
    shiftRequest?: Parameters<typeof presentShiftRequest>[0];
  },
>(session: T) {
  return {
    id: session.id,
    status: session.status,
    tenantId: session.tenantId,
    createdAt: session.createdAt,
    customerUserId: session.customerUserId ?? null,
    customerName: session.customer?.name ?? null,
    messages: session.messages,
    shiftRequest: presentShiftRequest(session.shiftRequest),
  };
}

export async function findSessionsForTenant() {
  const { tenantId } = requireTenantContext();
  const rows = await prisma.agentSession.findMany({
    where: { tenantId },
    include: sessionWithMessages,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(presentSession);
}

export async function findSessionForTenant(sessionId: string) {
  const { tenantId } = requireTenantContext();
  const session = await prisma.agentSession.findFirst({
    where: { tenantId, id: sessionId },
    include: sessionWithMessages,
  });
  return session ? presentSession(session) : null;
}

export async function findCustomerSessions(userId: string) {
  const { tenantId } = requireTenantContext();
  const prefix = customerRequestPrefix(userId);
  const rows = await prisma.agentSession.findMany({
    where: {
      tenantId,
      OR: [{ customerUserId: userId }, { externalMessageId: { startsWith: prefix } }],
    },
    include: sessionWithMessages,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(presentSession);
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
