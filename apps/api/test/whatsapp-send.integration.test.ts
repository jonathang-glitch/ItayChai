import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEV_TENANT_ID, WHATSAPP_SEND_REQUESTED } from '@itay-chai/contracts';
import {
  prisma,
  resetClientInbox,
  seedIdentity,
  SEED_PASSWORD,
  SEED_SHIFTS,
  SEED_USERS,
  SEED_WHATSAPP,
} from '@itay-chai/database';
import { clearRecordedWhatsAppSends, recordedWhatsAppSends } from '@itay-chai/integrations';
import { AppModule } from '../src/app.module.js';
import { processAgentSessionJob } from '../../worker/src/process-session.js';

let app: INestApplication;
let oriToken: string;

before(async () => {
  await seedIdentity();
  await resetClientInbox();
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: SEED_USERS.customerA.email, password: SEED_PASSWORD });
  assert.equal(login.status, 200, login.text);
  oriToken = login.body.accessToken as string;
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
});

test('cover offers are sent through the mock WhatsApp adapter', async () => {
  await seedIdentity();
  await resetClientInbox();
  clearRecordedWhatsAppSends();

  const created = await request(app.getHttpServer())
    .post('/api/v1/customer/requests')
    .set({ Authorization: `Bearer ${oriToken}`, 'x-tenant-id': DEV_TENANT_ID })
    .send({ shiftId: SEED_SHIFTS[0].id, kind: 'COVER' });
  assert.equal(created.status, 201, created.text);

  const events = await prisma.domainEvent.findMany({
    where: { eventType: WHATSAPP_SEND_REQUESTED },
  });
  const jobs = await prisma.outboxMessage.findMany({
    where: { eventId: { in: events.map((row) => row.id) } },
  });
  assert.ok(jobs.length >= 4);
  for (const job of jobs) {
    await processAgentSessionJob(job.payload);
  }

  const sentTo = recordedWhatsAppSends().map((row) => row.to);
  assert.ok(sentTo.includes(SEED_WHATSAPP.danaA));
  assert.ok(sentTo.includes(SEED_WHATSAPP.yossiA));
  assert.ok(sentTo.includes(SEED_WHATSAPP.customerA));
  assert.ok(
    recordedWhatsAppSends().some(
      (row) =>
        row.to === SEED_WHATSAPP.danaA &&
        row.text.includes('אורי צריך מחליף') &&
        row.buttons?.some((button) => button.title === 'כן'),
    ),
  );
  assert.ok(sentTo.includes(SEED_WHATSAPP.ownerA));
  assert.equal(await prisma.auditEntry.count({ where: { action: 'whatsapp.sent' } }), jobs.length);
});
