import { Prisma, type JobErrorClass } from '@prisma/client';
import { prisma } from './index.js';

export async function releaseIdempotency(tenantId: string, scope: string, key: string) {
  await prisma.idempotencyRecord.deleteMany({ where: { tenantId, scope, key } });
}

export async function claimIdempotency(tenantId: string, scope: string, key: string) {
  try {
    await prisma.idempotencyRecord.create({ data: { tenantId, scope, key } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

export async function startJobAttempt(tenantId: string, jobKey: string) {
  const previous = await prisma.jobAttempt.count({ where: { tenantId, jobKey } });
  return prisma.jobAttempt.create({
    data: { tenantId, jobKey, attempt: previous + 1 },
  });
}

export async function finishJobAttempt(
  id: string,
  result: { errorClass?: JobErrorClass; errorMessage?: string } = {},
) {
  await prisma.jobAttempt.update({
    where: { id },
    data: {
      finishedAt: new Date(),
      ...(result.errorClass ? { errorClass: result.errorClass } : {}),
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    },
  });
}

export async function quarantineJob(input: {
  tenantId: string;
  destination: string;
  eventId?: string;
  payload: unknown;
  errorClass: JobErrorClass;
  originalError: string;
}) {
  const existing = input.eventId
    ? await prisma.dlqItem.findFirst({
        where: { tenantId: input.tenantId, eventId: input.eventId, status: 'OPEN' },
      })
    : null;
  if (existing) {
    return existing;
  }
  return prisma.dlqItem.create({
    data: {
      tenantId: input.tenantId,
      destination: input.destination,
      ...(input.eventId ? { eventId: input.eventId } : {}),
      payload: input.payload as object,
      errorClass: input.errorClass,
      originalError: input.originalError,
    },
  });
}

export async function sessionTrace(tenantId: string, sessionId: string) {
  const events = await prisma.domainEvent.findMany({
    where: { tenantId, aggregateId: sessionId },
    orderBy: { createdAt: 'asc' },
  });
  const eventIds = events.map((item) => item.id);
  const jobKeys = [...eventIds, sessionId];
  const [outbox, attempts, audits] = await Promise.all([
    prisma.outboxMessage.findMany({
      where: eventIds.length > 0 ? { tenantId, eventId: { in: eventIds } } : { tenantId, id: 'none' },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.jobAttempt.findMany({
      where: { tenantId, jobKey: { in: jobKeys } },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.auditEntry.findMany({
      where: { tenantId, resourceId: sessionId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return { events, outbox, attempts, audits };
}
