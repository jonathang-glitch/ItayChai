import { Controller, Get, NotFoundException } from '@nestjs/common';
import { prisma } from '@itay-chai/database';

@Controller('api/v1/demo/tables')
export class DemoTablesController {
  @Get()
  async preview() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    const [sessions, messages, memberships, logins, failures, events] = await Promise.all([
      prisma.agentSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, tenantId: true, status: true, externalMessageId: true, createdAt: true },
      }),
      prisma.message.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, sessionId: true, direction: true, body: true, createdAt: true },
      }),
      prisma.tenantMembership.findMany({
        take: 8,
        select: { tenantId: true, userId: true, status: true },
      }),
      prisma.authSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, userId: true, createdAt: true, revokedAt: true },
      }),
      prisma.dlqItem.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, status: true, originalError: true, createdAt: true },
      }),
      prisma.domainEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, aggregateId: true, eventType: true, createdAt: true },
      }),
    ]);

    return {
      source: 'docker-postgres',
      host: '127.0.0.1:54322',
      tables: {
        agent_sessions: sessions,
        messages,
        tenant_memberships: memberships,
        auth_sessions: logins,
        dlq_items: failures,
        domain_events: events,
      },
    };
  }
}
