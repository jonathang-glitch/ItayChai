import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { mintAccessToken } from '@itay-chai/auth';
import { AGENT_SESSION_QUEUE, DEV_TENANT_ID } from '@itay-chai/contracts';
import { loadEnv } from '@itay-chai/config';
import { appPrisma, prisma, seedIdentity, SEED_USERS } from '@itay-chai/database';
import { createBullmqConsumer, createBullmqPublisher } from '@itay-chai/integrations';
import { AppModule } from '../src/app.module.js';
import { relayOnce } from '../../outbox-relay/src/relay.js';
import { processAgentSessionJob } from '../../worker/src/process-session.js';

let app: INestApplication;
let opsToken: string;
let ownerToken: string;
let publisher: ReturnType<typeof createBullmqPublisher>;
let consumer: ReturnType<typeof createBullmqConsumer>;
let timer: NodeJS.Timeout;

async function waitFor<T>(label: string, fn: () => Promise<T | null>): Promise<T> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = await fn();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(label);
}

before(async () => {
  await seedIdentity();
  opsToken = await mintAccessToken({
    sub: SEED_USERS.ops.authSubject,
    email: SEED_USERS.ops.email,
    amr: ['pwd', 'mfa'],
  });
  ownerToken = await mintAccessToken({
    sub: SEED_USERS.ownerA.authSubject,
    email: SEED_USERS.ownerA.email,
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

test('a committed session has one event and a published outbox row', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/v1/webhooks/whatsapp/mock')
    .send({ externalMessageId: `rel-${Date.now()}`, text: 'need a shift swap' });
  assert.equal(created.status, 200, created.text);

  await waitFor('session completed', async () => {
    await relayOnce(publisher);
    const session = await prisma.agentSession.findUnique({ where: { id: created.body.sessionId } });
    return session?.status === 'COMPLETED' ? session : null;
  });

  const published = await waitFor('outbox published through bullmq', async () => {
    await relayOnce(publisher);
    return prisma.outboxMessage.findFirst({
      where: { event: { aggregateId: created.body.sessionId }, publishedAt: { not: null } },
    });
  });
  assert.ok(published.publishedAt);

  const trace = await request(app.getHttpServer())
    .get(`/api/v1/sessions/${created.body.sessionId}/trace`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(trace.status, 200, trace.text);
  assert.equal(trace.body.events.length, 1);
  assert.equal(trace.body.outbox.length, 1);
  assert.ok(trace.body.outbox[0].publishedAt);
  assert.ok(trace.body.audits.length >= 1);
});

test('a permanent failure is visible in the DLQ and can be replayed', async () => {
  const injected = await request(app.getHttpServer())
    .post('/api/v1/ops/dlq/failures')
    .set('Authorization', `Bearer ${opsToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(injected.status, 201, injected.text);

  const item = await waitFor('dlq item', async () => {
    await relayOnce(publisher);
    return prisma.dlqItem.findFirst({
      where: { eventId: injected.body.eventId, status: 'OPEN' },
    });
  });

  const list = await request(app.getHttpServer())
    .get('/api/v1/ops/dlq')
    .set('Authorization', `Bearer ${opsToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(list.status, 200, list.text);
  assert.ok((list.body as { id: string }[]).some((row) => row.id === item.id));

  const replay = await request(app.getHttpServer())
    .post(`/api/v1/ops/dlq/${item.id}/replay`)
    .set('Authorization', `Bearer ${opsToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ reason: 'replay after visible failure' });
  assert.equal(replay.status, 201, replay.text);

  await waitFor('replayed session completed', async () => {
    await relayOnce(publisher);
    const session = await prisma.agentSession.findUnique({ where: { id: injected.body.sessionId } });
    return session?.status === 'COMPLETED' ? session : null;
  });

  const audits = await prisma.auditEntry.count({
    where: { resourceId: item.id, action: 'dlq.replayed' },
  });
  assert.equal(audits, 1);
});
