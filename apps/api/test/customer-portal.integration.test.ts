import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEV_TENANT_ID, ROLE_NAMES, SECOND_TENANT_ID, shiftLabelFromStart } from '@itay-chai/contracts';
import {
  appPrisma,
  prisma,
  seedIdentity,
  SEED_PASSWORD,
  SEED_SHIFTS,
  SEED_USERS,
} from '@itay-chai/database';
import { AppModule } from '../src/app.module.js';

let app: INestApplication;
let customerToken: string;
let ownerToken: string;
let ownerBToken: string;

before(async () => {
  await seedIdentity();
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const customer = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: SEED_USERS.customerA.email, password: SEED_PASSWORD });
  assert.equal(customer.status, 200, customer.text);
  customerToken = customer.body.accessToken as string;
  assert.equal(customer.body.memberships[0].roleName, ROLE_NAMES.CUSTOMER);

  const owner = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: SEED_USERS.ownerA.email, password: SEED_PASSWORD });
  ownerToken = owner.body.accessToken as string;

  const ownerB = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: SEED_USERS.ownerB.email, password: SEED_PASSWORD });
  ownerBToken = ownerB.body.accessToken as string;
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

test('customer can send a request the owner sees and cannot list all sessions', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/v1/customer/requests')
    .set('Authorization', `Bearer ${customerToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ shiftId: SEED_SHIFTS[0].id });
  assert.equal(created.status, 201, created.text);
  assert.equal(typeof created.body.id, 'string');
  assert.equal(created.body.customerName, 'אורי');
  assert.equal(created.body.customerUserId, SEED_USERS.customerA.id);
  const fridayMorning = shiftLabelFromStart(SEED_SHIFTS[0].startsAt);
  assert.equal(created.body.shiftRequest?.requestedLabel, fridayMorning);
  assert.equal(created.body.shiftRequest?.status, 'OPEN');
  assert.ok(
    (created.body.messages as { direction: string; body: string }[]).some(
      (message) =>
        message.direction === 'INBOUND' && message.body === `צריך החלפה ב${fridayMorning}`,
    ),
  );
  assert.ok(
    (created.body.messages as { direction: string; body: string }[]).some(
      (message) => message.direction === 'OUTBOUND' && message.body === 'Your request was received.',
    ),
  );

  const mine = await request(app.getHttpServer())
    .get('/api/v1/customer/requests')
    .set('Authorization', `Bearer ${customerToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(mine.status, 200, mine.text);
  assert.ok((mine.body as { id: string }[]).some((row) => row.id === created.body.id));

  const forbidden = await request(app.getHttpServer())
    .get('/api/v1/sessions')
    .set('Authorization', `Bearer ${customerToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(forbidden.status, 403, forbidden.text);

  const ownerDesk = await request(app.getHttpServer())
    .get('/api/v1/sessions')
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(ownerDesk.status, 200, ownerDesk.text);
  const seen = (
    ownerDesk.body as { id: string; customerName: string | null; shiftRequest?: { requestedLabel: string } | null }[]
  ).find((row) => row.id === created.body.id);
  assert.ok(seen);
  assert.equal(seen.customerName, 'אורי');
  assert.equal(seen.shiftRequest?.requestedLabel, fridayMorning);

  const decided = await request(app.getHttpServer())
    .post(`/api/v1/sessions/${created.body.id}/shift-decision`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ action: 'approve' });
  assert.equal(decided.status, 200, decided.text);
  assert.equal(decided.body.shiftRequest?.status, 'APPROVED');
  assert.ok(
    (decided.body.messages as { direction: string; body: string }[]).some(
      (message) => message.direction === 'OUTBOUND' && message.body === 'הבקשה אושרה.',
    ),
  );

  const afterApprove = await request(app.getHttpServer())
    .get('/api/v1/customer/requests/shifts')
    .set('Authorization', `Bearer ${customerToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(afterApprove.status, 200, afterApprove.text);
  assert.ok(!(afterApprove.body as { id: string }[]).some((shift) => shift.id === SEED_SHIFTS[0].id));

  const ownerBBlocked = await request(app.getHttpServer())
    .get('/api/v1/sessions')
    .set('Authorization', `Bearer ${ownerBToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(ownerBBlocked.status, 403, ownerBBlocked.text);

  const ownerCannotWriteAsCustomer = await request(app.getHttpServer())
    .post('/api/v1/customer/requests')
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ text: 'should fail' });
  assert.equal(ownerCannotWriteAsCustomer.status, 403, ownerCannotWriteAsCustomer.text);

  const otherTenant = await request(app.getHttpServer())
    .get('/api/v1/customer/requests')
    .set('Authorization', `Bearer ${customerToken}`)
    .set('x-tenant-id', SECOND_TENANT_ID);
  assert.equal(otherTenant.status, 403, otherTenant.text);
});
