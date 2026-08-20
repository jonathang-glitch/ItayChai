import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { mintAccessToken } from '@itay-chai/auth';
import { DEV_TENANT_ID, SECOND_TENANT_ID } from '@itay-chai/contracts';
import { appPrisma, prisma, seedIdentity, SEED_USERS } from '@itay-chai/database';
import { AppModule } from '../src/app.module.js';

let app: INestApplication;
let ownerAToken: string;
let ownerBToken: string;
let stakeholderToken: string;
let opsNoMfaToken: string;
let opsMfaToken: string;
let tenantASessionId: string;

before(async () => {
  await seedIdentity();
  ownerAToken = await mintAccessToken({ sub: SEED_USERS.ownerA.authSubject, email: SEED_USERS.ownerA.email });
  ownerBToken = await mintAccessToken({ sub: SEED_USERS.ownerB.authSubject, email: SEED_USERS.ownerB.email });
  stakeholderToken = await mintAccessToken({
    sub: SEED_USERS.stakeholderA.authSubject,
    email: SEED_USERS.stakeholderA.email,
  });
  opsNoMfaToken = await mintAccessToken({ sub: SEED_USERS.ops.authSubject, email: SEED_USERS.ops.email, amr: ['pwd'] });
  opsMfaToken = await mintAccessToken({
    sub: SEED_USERS.ops.authSubject,
    email: SEED_USERS.ops.email,
    amr: ['pwd', 'mfa'],
  });

  const session = await prisma.agentSession.create({
    data: {
      tenantId: DEV_TENANT_ID,
      status: 'COMPLETED',
      version: 3,
      externalMessageId: `iso-${Date.now()}`,
    },
  });
  tenantASessionId = session.id;

  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

test('owner A can read tenant A sessions and cannot see tenant B', async () => {
  const own = await request(app.getHttpServer())
    .get('/api/v1/sessions')
    .set('Authorization', `Bearer ${ownerAToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(own.status, 200, own.text);
  assert.ok((own.body as { id: string }[]).some((row) => row.id === tenantASessionId));

  const other = await request(app.getHttpServer())
    .get('/api/v1/sessions')
    .set('Authorization', `Bearer ${ownerAToken}`)
    .set('x-tenant-id', SECOND_TENANT_ID);
  assert.equal(other.status, 403, other.text);
});

test('owner B cannot read tenant A sessions', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/v1/sessions')
    .set('Authorization', `Bearer ${ownerBToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(response.status, 403, response.text);
});

test('owner B cannot mutate a tenant A session', async () => {
  const crossTenantHeader = await request(app.getHttpServer())
    .post(`/api/v1/sessions/${tenantASessionId}/acknowledge`)
    .set('Authorization', `Bearer ${ownerBToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(crossTenantHeader.status, 403, crossTenantHeader.text);

  const hiddenId = await request(app.getHttpServer())
    .post(`/api/v1/sessions/${tenantASessionId}/acknowledge`)
    .set('Authorization', `Bearer ${ownerBToken}`)
    .set('x-tenant-id', SECOND_TENANT_ID);
  assert.equal(hiddenId.status, 404, hiddenId.text);
});

test('stakeholder cannot write sessions in their own tenant', async () => {
  const response = await request(app.getHttpServer())
    .post(`/api/v1/sessions/${tenantASessionId}/acknowledge`)
    .set('Authorization', `Bearer ${stakeholderToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(response.status, 403, response.text);
});

test('owner A can acknowledge a session in their tenant', async () => {
  const response = await request(app.getHttpServer())
    .post(`/api/v1/sessions/${tenantASessionId}/acknowledge`)
    .set('Authorization', `Bearer ${ownerAToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(response.status, 201, response.text);
});

test('owner cannot open break-glass and a short reason is rejected', async () => {
  const owner = await request(app.getHttpServer())
    .post('/api/v1/ops/break-glass')
    .set('Authorization', `Bearer ${ownerAToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ tenantId: DEV_TENANT_ID, reason: 'investigate failed worker' });
  assert.equal(owner.status, 403, owner.text);

  const shortReason = await request(app.getHttpServer())
    .post('/api/v1/ops/break-glass')
    .set('Authorization', `Bearer ${opsMfaToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ tenantId: DEV_TENANT_ID, reason: 'short' });
  assert.equal(shortReason.status, 400, shortReason.text);
});

test('ops break-glass requires MFA and a reason', async () => {
  const missingMfa = await request(app.getHttpServer())
    .post('/api/v1/ops/break-glass')
    .set('Authorization', `Bearer ${opsNoMfaToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ tenantId: DEV_TENANT_ID, reason: 'investigate failed worker' });
  assert.equal(missingMfa.status, 403, missingMfa.text);

  const ok = await request(app.getHttpServer())
    .post('/api/v1/ops/break-glass')
    .set('Authorization', `Bearer ${opsMfaToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ tenantId: DEV_TENANT_ID, reason: 'investigate failed worker' });
  assert.equal(ok.status, 201, ok.text);
});
