import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEV_TENANT_ID, SECOND_TENANT_ID, WHATSAPP_PROVIDER } from '@itay-chai/contracts';
import { appPrisma, enqueueOwnerWhatsApp, prisma, seedIdentity } from '@itay-chai/database';
import { AppModule } from '../src/app.module.js';

let app: INestApplication;

before(async () => {
  await seedIdentity();
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

function auth(token: string, tenantId: string) {
  return { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId };
}

async function openShop(stamp: number, phone = `+97252${String(stamp).slice(-7)}`) {
  const email = `owner-${stamp}@example.com`;
  const password = 'shop-password';
  const signup = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
    shopName: `חנות ${stamp}`,
    ownerName: 'בעלים',
    email,
    password,
    whatsapp: phone,
  });
  assert.equal(signup.status, 200, signup.text);
  const tenantId = signup.body.memberships[0].tenantId as string;
  assert.notEqual(tenantId, DEV_TENANT_ID);
  assert.notEqual(tenantId, SECOND_TENANT_ID);
  return { email, password, tenantId, token: signup.body.accessToken as string, phone };
}

test('signup creates a shop the demo seed does not own and login works', async () => {
  const stamp = Date.now();
  const shop = await openShop(stamp);
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: shop.email, password: shop.password });
  assert.equal(login.status, 200, login.text);
  assert.equal(login.body.memberships[0].tenantId, shop.tenantId);
  const duplicate = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
    shopName: 'עוד חנות',
    ownerName: 'בעלים',
    email: shop.email,
    password: shop.password,
    whatsapp: '+972529999999',
  });
  assert.equal(duplicate.status, 409, duplicate.text);
});

function freshPhone() {
  const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
  return `+9725${digits}`;
}

function message(from: string, text: string) {
  return request(app.getHttpServer()).post('/api/v1/webhooks/whatsapp').send({
    from,
    externalMessageId: randomUUID(),
    text,
  });
}

test('owner adds a worker, the password works, and the phone is stored', async () => {
  const shop = await openShop(Date.now() + 1);
  const email = `worker-${Date.now()}@example.com`;
  const password = 'worker-password';
  const phone = freshPhone();
  const created = await request(app.getHttpServer())
    .post('/api/v1/roster/workers')
    .set(auth(shop.token, shop.tenantId))
    .send({ name: 'דנה', email, password, whatsapp: phone });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.body.password, password);
  const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });
  assert.equal(login.status, 200, login.text);
  const listed = await request(app.getHttpServer())
    .get('/api/v1/roster/workers')
    .set(auth(shop.token, shop.tenantId));
  assert.equal(listed.status, 200, listed.text);
  assert.equal(listed.body.workers[0].phone, phone);
  assert.equal(listed.body.workers[0].email, email);
  const reused = await request(app.getHttpServer())
    .post('/api/v1/roster/workers')
    .set(auth(shop.token, shop.tenantId))
    .send({ name: 'אחר', email: `other-${Date.now()}@example.com`, password, whatsapp: phone });
  assert.equal(reused.status, 409, reused.text);
});

test('delete is refused while a search is open and succeeds after it is cancelled', async () => {
  const shop = await openShop(Date.now() + 2);
  const danaPhone = freshPhone();
  const requester = await request(app.getHttpServer())
    .post('/api/v1/roster/workers')
    .set(auth(shop.token, shop.tenantId))
    .send({ name: 'דנה', email: `dana-${Date.now()}@example.com`, password: 'worker-password', whatsapp: danaPhone });
  const coworker = await request(app.getHttpServer())
    .post('/api/v1/roster/workers')
    .set(auth(shop.token, shop.tenantId))
    .send({ name: 'יוסי', email: `yossi-${Date.now()}@example.com`, password: 'worker-password', whatsapp: freshPhone() });
  assert.equal(requester.status, 201, requester.text);
  assert.equal(coworker.status, 201, coworker.text);
  const shift = await request(app.getHttpServer())
    .post('/api/v1/roster/shifts')
    .set(auth(shop.token, shop.tenantId))
    .send({
      employeeId: requester.body.id,
      startsAt: '2026-10-16T05:00:00.000Z',
      endsAt: '2026-10-16T11:00:00.000Z',
    });
  assert.equal(shift.status, 201, shift.text);
  const created = await message(danaPhone, 'כיסוי');
  assert.equal(created.status, 200, created.text);
  assert.equal(created.body.handled, 'new_request');
  const blocked = await request(app.getHttpServer())
    .delete(`/api/v1/roster/workers/${requester.body.id}`)
    .set(auth(shop.token, shop.tenantId));
  assert.equal(blocked.status, 409, blocked.text);
  const cancelled = await message(danaPhone, 'ביטול');
  assert.equal(cancelled.status, 200, cancelled.text);
  assert.equal(cancelled.body.handled, 'cancel');
  const removed = await request(app.getHttpServer())
    .delete(`/api/v1/roster/workers/${requester.body.id}`)
    .set(auth(shop.token, shop.tenantId));
  assert.equal(removed.status, 200, removed.text);
});

test('creating two shifts on the same day for one person fails', async () => {
  const shop = await openShop(Date.now() + 3);
  const worker = await request(app.getHttpServer())
    .post('/api/v1/roster/workers')
    .set(auth(shop.token, shop.tenantId))
    .send({ name: 'דנה', email: `sameday-${Date.now()}@example.com`, password: 'worker-password', whatsapp: freshPhone() });
  assert.equal(worker.status, 201, worker.text);
  const first = await request(app.getHttpServer())
    .post('/api/v1/roster/shifts')
    .set(auth(shop.token, shop.tenantId))
    .send({
      employeeId: worker.body.id,
      startsAt: '2026-10-16T05:00:00.000Z',
      endsAt: '2026-10-16T11:00:00.000Z',
    });
  assert.equal(first.status, 201, first.text);
  const second = await request(app.getHttpServer())
    .post('/api/v1/roster/shifts')
    .set(auth(shop.token, shop.tenantId))
    .send({
      employeeId: worker.body.id,
      startsAt: '2026-10-16T13:00:00.000Z',
      endsAt: '2026-10-16T19:00:00.000Z',
    });
  assert.equal(second.status, 409, second.text);
});

test('a reply that names one person updates only that offer', async () => {
  const shop = await openShop(Date.now() + 4);
  async function add(name: string, key: string, phone: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/roster/workers')
      .set(auth(shop.token, shop.tenantId))
      .send({ name, email: `${key}-${Date.now()}@example.com`, password: 'worker-password', whatsapp: phone });
    assert.equal(created.status, 201, created.text);
    return created.body as { id: string };
  }
  const danaPhone = freshPhone();
  const yossiPhone = freshPhone();
  const roeiPhone = freshPhone();
  const dana = await add('דנה', 'dana', danaPhone);
  const yossi = await add('יוסי', 'yossi', yossiPhone);
  const roei = await add('רועי', 'roei', roeiPhone);
  async function give(employeeId: string, startsAt: string, endsAt: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/roster/shifts')
      .set(auth(shop.token, shop.tenantId))
      .send({ employeeId, startsAt, endsAt });
    assert.equal(created.status, 201, created.text);
    return created.body.id as string;
  }
  const friday = await give(dana.id, '2026-10-16T05:00:00.000Z', '2026-10-16T11:00:00.000Z');
  const saturday = await give(yossi.id, '2026-10-17T05:00:00.000Z', '2026-10-17T11:00:00.000Z');
  async function ask(from: string) {
    const created = await message(from, 'לא יכול להגיע');
    assert.equal(created.status, 200, created.text);
    assert.equal(created.body.handled, 'new_request');
  }
  await ask(danaPhone);
  await ask(yossiPhone);
  const inbound = await request(app.getHttpServer()).post('/api/v1/webhooks/whatsapp').send({
    from: roeiPhone,
    externalMessageId: randomUUID(),
    text: 'כן לדנה',
  });
  assert.equal(inbound.status, 200, inbound.text);
  assert.equal(inbound.body.handled, 'offer');
  const fridayRow = await prisma.shift.findUnique({ where: { id: friday } });
  const saturdayRow = await prisma.shift.findUnique({ where: { id: saturday } });
  assert.equal(fridayRow?.employeeId, roei.id);
  assert.equal(saturdayRow?.employeeId, yossi.id);
  const stillOpen = await prisma.shiftOffer.findFirst({
    where: { employeeId: roei.id, status: 'PENDING', request: { employeeId: yossi.id } },
  });
  assert.ok(stillOpen);
});

test('owner notice is enqueued on the Twilio path when the owner has a real phone', async () => {
  const phone = freshPhone();
  const shop = await openShop(Date.now() + 5, phone);
  const previous = process.env.WHATSAPP_PROVIDER;
  process.env.WHATSAPP_PROVIDER = 'twilio';
  try {
    const eventId = await prisma.$transaction((tx) =>
      enqueueOwnerWhatsApp(tx, shop.tenantId, 'עדכון לבעלים', randomUUID()),
    );
    assert.equal(typeof eventId, 'string');
    const outbox = await prisma.outboxMessage.findFirst({ where: { eventId: eventId! } });
    assert.ok(outbox);
    const payload = outbox?.payload as { to?: string; text?: string };
    assert.equal(payload.to, phone);
    assert.equal(payload.text, 'עדכון לבעלים');
    const identity = await prisma.stakeholderIdentity.findFirst({
      where: { tenantId: shop.tenantId, channel: WHATSAPP_PROVIDER, externalId: phone },
    });
    assert.ok(identity);
  } finally {
    process.env.WHATSAPP_PROVIDER = previous;
  }
});

test('Twilio webhook rejects a bad signature and accepts a valid one', async () => {
  const previousProvider = process.env.WHATSAPP_PROVIDER;
  const previousToken = process.env.TWILIO_AUTH_TOKEN;
  const previousUrl = process.env.TWILIO_WEBHOOK_URL;
  const url = 'https://shop.example/api/v1/webhooks/whatsapp';
  const token = 'test-token';
  const params = { Body: 'כן', From: 'whatsapp:+972599999999', MessageSid: `SM${randomUUID()}` };
  const signature = createHmac('sha1', token)
    .update(
      Object.keys(params)
        .sort()
        .reduce((base, key) => `${base}${key}${params[key as keyof typeof params]}`, url),
      'utf8',
    )
    .digest('base64');
  process.env.WHATSAPP_PROVIDER = 'twilio';
  process.env.TWILIO_AUTH_TOKEN = token;
  process.env.TWILIO_WEBHOOK_URL = url;
  try {
    const denied = await request(app.getHttpServer()).post('/api/v1/webhooks/whatsapp').send(params);
    assert.equal(denied.status, 403, denied.text);
    const accepted = await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-twilio-signature', signature)
      .send(params);
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(accepted.body.ignored, 'unknown_sender');
  } finally {
    process.env.WHATSAPP_PROVIDER = previousProvider;
    if (previousToken === undefined) {
      delete process.env.TWILIO_AUTH_TOKEN;
    } else {
      process.env.TWILIO_AUTH_TOKEN = previousToken;
    }
    if (previousUrl === undefined) {
      delete process.env.TWILIO_WEBHOOK_URL;
    } else {
      process.env.TWILIO_WEBHOOK_URL = previousUrl;
    }
  }
});
