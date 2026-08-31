import { requireTenantContext } from '@itay-chai/auth';
import { customerRequestPrefix } from '@itay-chai/contracts';
import { prisma } from './index.js';
import { presentShiftRequest } from './shifts.js';
import { withTenantDb } from './tenant-db.js';

const sessionWithMessages = {
  messages: { orderBy: { createdAt: 'desc' as const }, take: 16 },
  customer: { select: { id: true, name: true, email: true } },
  shiftRequest: {
    include: {
      shift: { select: { id: true, label: true, startsAt: true, endsAt: true } },
      employee: { select: { displayName: true } },
      counterpart: { select: { displayName: true } },
      proposedShift: { select: { id: true, label: true, startsAt: true, endsAt: true } },
      offers: {
        select: {
          id: true,
          status: true,
          allowCover: true,
          allowSwap: true,
          employee: { select: { displayName: true } },
          proposedShift: { select: { startsAt: true, endsAt: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
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
    messages: [...session.messages].reverse(),
    shiftRequest: presentShiftRequest(session.shiftRequest),
  };
}

const NOTICE_PREFIX = 'notice:';

export async function findSessionsForTenant() {
  const { tenantId } = requireTenantContext();
  const rows = await prisma.agentSession.findMany({
    where: { tenantId, NOT: { externalMessageId: { startsWith: NOTICE_PREFIX } } },
    include: sessionWithMessages,
    orderBy: { createdAt: 'desc' },
    take: 24,
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
  const mine = {
    tenantId,
    OR: [{ customerUserId: userId }, { externalMessageId: { startsWith: prefix } }],
  } as const;
  const [requests, notices] = await Promise.all([
    prisma.agentSession.findMany({
      where: { ...mine, NOT: { externalMessageId: { startsWith: NOTICE_PREFIX } } },
      include: sessionWithMessages,
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.agentSession.findMany({
      where: { tenantId, customerUserId: userId, externalMessageId: { startsWith: NOTICE_PREFIX } },
      include: sessionWithMessages,
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
  ]);
  return [...requests, ...notices]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map(presentSession);
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
