import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEV_TENANT_ID } from '@itay-chai/contracts';
import {
  DANA_EMPLOYEE_ID,
  DANA_FREE_SHIFT,
  ORI_EMPLOYEE_ID,
  prisma,
  resetClientInbox,
  seedIdentity,
  SEED_PASSWORD,
  SEED_SHIFTS,
  SEED_USERS,
  SEED_WHATSAPP,
} from '@itay-chai/database';
import { AppModule } from '../src/app.module.js';

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

function inbound(from: string, text: string, id = randomUUID()) {
  return request(app.getHttpServer()).post('/api/v1/webhooks/whatsapp').send({
    from,
    externalMessageId: id,
    text,
  });
}

async function startCover() {
  await seedIdentity();
  await resetClientInbox();
  const created = await request(app.getHttpServer())
    .post('/api/v1/customer/requests')
    .set({ Authorization: `Bearer ${oriToken}`, 'x-tenant-id': DEV_TENANT_ID })
    .send({ shiftId: SEED_SHIFTS[0].id, kind: 'COVER' });
  assert.equal(created.status, 201, created.text);
  return created.body as { id: string };
}

test('webhook verify echoes the challenge', async () => {
  const ok = await request(app.getHttpServer()).get('/api/v1/webhooks/whatsapp').query({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'dev-verify-token',
    'hub.challenge': 'abc123',
  });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.text, 'abc123');
  const denied = await request(app.getHttpServer()).get('/api/v1/webhooks/whatsapp').query({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'wrong',
    'hub.challenge': 'abc123',
  });
  assert.equal(denied.status, 403);
});

test('unknown number and empty Meta payloads are ignored', async () => {
  const unknown = await inbound('+972599999999', 'כן');
  assert.equal(unknown.status, 200, unknown.text);
  assert.equal(unknown.body.ignored, 'unknown_sender');
  const empty = await request(app.getHttpServer())
    .post('/api/v1/webhooks/whatsapp')
    .send({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { statuses: [] } }] }] });
  assert.equal(empty.status, 200);
  assert.equal(empty.body.ignored, 'no_message');
});

test('dana saying כן on a cover takes Friday and is duplicate-safe', async () => {
  await startCover();
  const id = `in-${randomUUID()}`;
  const first = await inbound(SEED_WHATSAPP.danaA, 'כן', id);
  assert.equal(first.status, 200, first.text);
  assert.equal(first.body.handled, 'offer');
  const friday = await prisma.shift.findUnique({ where: { id: SEED_SHIFTS[0].id } });
  assert.equal(friday?.employeeId, DANA_EMPLOYEE_ID);
  const again = await inbound(SEED_WHATSAPP.danaA, 'כן', id);
  assert.equal(again.body.duplicate, true);
});

test('swap confirm works from WhatsApp text', async () => {
  await seedIdentity();
  await resetClientInbox();
  const created = await request(app.getHttpServer())
    .post('/api/v1/customer/requests')
    .set({ Authorization: `Bearer ${oriToken}`, 'x-tenant-id': DEV_TENANT_ID })
    .send({ shiftId: SEED_SHIFTS[0].id, kind: 'SWAP' });
  assert.equal(created.status, 201, created.text);
  const offer = await inbound(SEED_WHATSAPP.danaA, 'החלפה');
  assert.equal(offer.body.handled, 'offer', offer.text);
  const confirm = await inbound(SEED_WHATSAPP.customerA, 'מאשר החלפה');
  assert.equal(confirm.body.handled, 'match', confirm.text);
  const friday = await prisma.shift.findUnique({ where: { id: SEED_SHIFTS[0].id } });
  assert.equal(friday?.employeeId, DANA_EMPLOYEE_ID);
  const wednesday = await prisma.shift.findUnique({ where: { id: DANA_FREE_SHIFT.id } });
  assert.equal(wednesday?.employeeId, ORI_EMPLOYEE_ID);
});

test('Meta-shaped inbound and a new request from Ori both work', async () => {
  await seedIdentity();
  await resetClientInbox();
  const started = await inbound(SEED_WHATSAPP.customerA, 'צריך מחליף בשישי');
  assert.equal(started.status, 200, started.text);
  assert.equal(started.body.handled, 'new_request');
  const seeking = await prisma.shiftSwapRequest.findFirst({
    where: { employee: { userId: SEED_USERS.customerA.id }, status: 'SEEKING' },
  });
  assert.ok(seeking);
  const meta = await request(app.getHttpServer())
    .post('/api/v1/webhooks/whatsapp')
    .send({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: `wamid-${randomUUID()}`,
                    from: '972500000002',
                    type: 'text',
                    text: { body: 'כן' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  assert.equal(meta.status, 200, meta.text);
  assert.equal(meta.body.handled, 'offer');
});
