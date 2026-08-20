import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AGENT_SESSION_QUEUE, DEV_TENANT_ID, MOCK_WHATSAPP_REPLY } from '@itay-chai/contracts';
import { loadEnv } from '@itay-chai/config';
import { appPrisma, prisma } from '@itay-chai/database';
import { createBullmqConsumer, createBullmqPublisher } from '@itay-chai/integrations';
import { AppModule } from '../src/app.module.js';
import { relayOnce } from '../../outbox-relay/src/relay.js';
import { processAgentSessionJob } from '../../worker/src/process-session.js';

const messageId = `msg-${Date.now()}`;
let app: INestApplication;
let publisher: ReturnType<typeof createBullmqPublisher>;
let consumer: ReturnType<typeof createBullmqConsumer>;
let timer: NodeJS.Timeout;

async function waitForCompleted(sessionId: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await relayOnce(publisher);
    const session = await prisma.agentSession.findUniqueOrThrow({ where: { id: sessionId } });
    if (session.status === 'COMPLETED') {
      return session;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Session ${sessionId} did not reach COMPLETED`);
}

before(async () => {
  await prisma.tenant.upsert({
    where: { id: DEV_TENANT_ID },
    create: { id: DEV_TENANT_ID, name: 'Development Tenant', status: 'active' },
    update: { name: 'Development Tenant', status: 'active' },
  });
  const env = loadEnv();
  publisher = createBullmqPublisher(env.REDIS_URL);
  consumer = createBullmqConsumer(env.REDIS_URL);
  await consumer.consume(AGENT_SESSION_QUEUE, processAgentSessionJob);
  timer = setInterval(() => {
    void relayOnce(publisher);
  }, 200);

  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
});

after(async () => {
  clearInterval(timer);
  await app.close();
  await consumer.close();
  await publisher.close();
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

test('mock WhatsApp request creates one completed session and is duplicate-safe', async () => {
  const first = await request(app.getHttpServer())
    .post('/api/v1/webhooks/whatsapp/mock')
    .send({ externalMessageId: messageId, text: 'need a shift swap' });
  assert.equal(first.status, 200, first.text);

  assert.equal(first.body.message, MOCK_WHATSAPP_REPLY);
  assert.equal(typeof first.body.sessionId, 'string');

  const session = await waitForCompleted(first.body.sessionId);
  const [sessions, transitions, inbound, outbound, audits, receipts] = await Promise.all([
    prisma.agentSession.count({ where: { externalMessageId: messageId } }),
    prisma.sessionTransition.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.message.count({ where: { sessionId: session.id, direction: 'INBOUND' } }),
    prisma.message.count({ where: { sessionId: session.id, direction: 'OUTBOUND' } }),
    prisma.auditEntry.count({ where: { resourceId: session.id } }),
    prisma.webhookReceipt.count({
      where: { provider: 'whatsapp', externalMessageId: messageId },
    }),
  ]);

  assert.equal(sessions, 1);
  assert.equal(session.status, 'COMPLETED');
  assert.deepEqual(
    transitions.map((row) => [row.fromStatus, row.toStatus]),
    [
      ['DRAFT', 'INITIALIZING'],
      ['INITIALIZING', 'PLANNING'],
      ['PLANNING', 'COMPLETED'],
    ],
  );
  assert.equal(inbound, 1);
  assert.equal(outbound, 1);
  assert.ok(audits >= 2);
  assert.equal(receipts, 1);

  const second = await request(app.getHttpServer())
    .post('/api/v1/webhooks/whatsapp/mock')
    .send({ externalMessageId: messageId, text: 'need a shift swap' })
    .expect(200);

  assert.equal(second.body.sessionId, first.body.sessionId);
  assert.equal(await prisma.agentSession.count({ where: { externalMessageId: messageId } }), 1);
  assert.equal(
    await prisma.webhookReceipt.count({
      where: { provider: 'whatsapp', externalMessageId: messageId },
    }),
    1,
  );
});
