import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashPassword, mintAccessToken } from '@itay-chai/auth';
import { DEV_TENANT_ID, ROLE_NAMES } from '@itay-chai/contracts';
import { appPrisma, prisma, seedIdentity, SEED_PASSWORD, SEED_USERS } from '@itay-chai/database';
import { AppModule } from '../src/app.module.js';

let app: INestApplication;
let ownerAToken: string;

before(async () => {
  await seedIdentity();
  ownerAToken = await mintAccessToken({
    sub: SEED_USERS.ownerA.authSubject,
    email: SEED_USERS.ownerA.email,
  });
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

test('login refresh and logout form a closed session', async () => {
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: SEED_USERS.ownerA.email, password: SEED_PASSWORD });
  assert.equal(login.status, 200, login.text);
  assert.equal(typeof login.body.accessToken, 'string');
  assert.equal(typeof login.body.refreshToken, 'string');

  const rejected = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: SEED_USERS.ownerA.email, password: 'wrong-password' });
  assert.equal(rejected.status, 401, rejected.text);

  const refreshed = await request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: login.body.refreshToken });
  assert.equal(refreshed.status, 200, refreshed.text);

  const reused = await request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: login.body.refreshToken });
  assert.equal(reused.status, 401, reused.text);

  const logout = await request(app.getHttpServer())
    .post('/api/v1/auth/logout')
    .send({ refreshToken: refreshed.body.refreshToken });
  assert.equal(logout.status, 200, logout.text);

  const afterLogout = await request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: refreshed.body.refreshToken });
  assert.equal(afterLogout.status, 401, afterLogout.text);
});

test('expired access tokens are rejected', async () => {
  const expired = await mintAccessToken(
    { sub: SEED_USERS.ownerA.authSubject, email: SEED_USERS.ownerA.email },
    new Date(0),
  );
  const response = await request(app.getHttpServer())
    .get('/api/v1/sessions')
    .set('Authorization', `Bearer ${expired}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(response.status, 401, response.text);
});

test('password recovery rotates the password and revokes sessions', async () => {
  const email = `recover-${Date.now()}@example.com`;
  await prisma.user.create({
    data: {
      authSubject: `auth-recover-${Date.now()}`,
      email,
      passwordHash: hashPassword(SEED_PASSWORD),
    },
  });

  const recover = await request(app.getHttpServer())
    .post('/api/v1/auth/recover')
    .send({ email });
  assert.equal(recover.status, 200, recover.text);
  assert.equal(typeof recover.body.resetToken, 'string');

  const nextPassword = 'recovered-password';
  const reset = await request(app.getHttpServer())
    .post('/api/v1/auth/reset')
    .send({ resetToken: recover.body.resetToken, password: nextPassword });
  assert.equal(reset.status, 200, reset.text);

  const oldPassword = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: SEED_PASSWORD });
  assert.equal(oldPassword.status, 401, oldPassword.text);

  const nextLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: nextPassword });
  assert.equal(nextLogin.status, 200, nextLogin.text);
});

test('owner can invite a stakeholder who then belongs only to that tenant', async () => {
  const email = `invited-${Date.now()}@example.com`;
  const invite = await request(app.getHttpServer())
    .post('/api/v1/invitations')
    .set('Authorization', `Bearer ${ownerAToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ email, roleName: ROLE_NAMES.STAKEHOLDER });
  assert.equal(invite.status, 201, invite.text);
  assert.equal(typeof invite.body.inviteToken, 'string');

  const accepted = await request(app.getHttpServer())
    .post('/api/v1/auth/accept-invite')
    .send({ inviteToken: invite.body.inviteToken, password: 'invite-password' });
  assert.equal(accepted.status, 200, accepted.text);

  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: 'invite-password' });
  assert.equal(login.status, 200, login.text);

  const ownTenant = await request(app.getHttpServer())
    .get('/api/v1/sessions')
    .set('Authorization', `Bearer ${login.body.accessToken}`)
    .set('x-tenant-id', DEV_TENANT_ID);
  assert.equal(ownTenant.status, 200, ownTenant.text);
});

test('authenticated users can register a device', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/devices')
    .set('Authorization', `Bearer ${ownerAToken}`)
    .set('x-tenant-id', DEV_TENANT_ID)
    .send({ platform: 'ios', installationId: `install-${Date.now()}`, pushToken: `push-${Date.now()}` });
  assert.equal(response.status, 201, response.text);
  assert.equal(response.body.platform, 'ios');
});
