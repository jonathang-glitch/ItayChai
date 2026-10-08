import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { appPrisma, prisma, seedIdentity } from '@itay-chai/database';
import { AppModule } from '../src/app.module.js';
import { pickToken } from '../src/roster/pick-link.js';

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

function phone() {
  return `+9725${`${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8)}`;
}

async function shopWithWeek() {
  const stamp = Date.now();
  const signup = await request(app.getHttpServer())
    .post('/api/v1/auth/signup')
    .send({
      shopName: `חנות ${stamp}`,
      email: `pick-${stamp}@example.com`,
      password: 'shop-password',
      whatsapp: phone(),
    });
  assert.equal(signup.status, 200, signup.text);
  const tenantId = signup.body.memberships[0].tenantId as string;
  const auth = { Authorization: `Bearer ${signup.body.accessToken}`, 'x-tenant-id': tenantId };
  const workers = [];
  for (const name of ['דנה', 'יוסי']) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/roster/workers')
      .set(auth)
      .send({ name, whatsapp: phone() });
    assert.equal(created.status, 201, created.text);
    workers.push(created.body.id as string);
  }
  const saved = await request(app.getHttpServer())
    .post('/api/v1/roster/week')
    .set(auth)
    .send({
      openDays: [0, 1, 2, 3, 4, 5, 6],
      opensAt: '08:00',
      closesAt: '22:00',
      parts: 2,
      needed: 1,
      minShifts: 0,
      maxShifts: 3,
      minWeekend: 0,
      maxWeekend: 0,
      closedDates: [],
      skippedHolidays: [],
    });
  assert.equal(saved.status, 200, saved.text);
  const built = await request(app.getHttpServer()).post('/api/v1/roster/week/build').set(auth);
  assert.equal(built.status, 200, built.text);
  return { tenantId, workers, slots: built.body.slots as { id: string }[] };
}

test('a worker opens the link, sees the week and saves picks inside the rules', async () => {
  const shop = await shopWithWeek();
  const [dana, yossi] = shop.workers as [string, string];
  const danaLink = `/api/v1/pick/${pickToken(shop.tenantId, dana)}`;
  const page = await request(app.getHttpServer()).get(danaLink);
  assert.equal(page.status, 200, page.text);
  assert.equal(page.body.workerName, 'דנה');
  assert.ok(page.body.rules.includes('עד 3 משמרות'));
  const [first, second] = page.body.slots as { id: string }[];
  assert.ok(first && second);

  const sameDay = await request(app.getHttpServer())
    .put(danaLink)
    .send({ slotIds: [first.id, second.id] });
  assert.equal(sameDay.status, 409, sameDay.text);
  assert.equal(sameDay.body.message, 'אפשר משמרת אחת ביום.');

  const saved = await request(app.getHttpServer())
    .put(danaLink)
    .send({ slotIds: [first.id] });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(saved.body.slots.find((slot: { id: string }) => slot.id === first.id)?.mine, true);

  const yossiLink = `/api/v1/pick/${pickToken(shop.tenantId, yossi)}`;
  const taken = await request(app.getHttpServer())
    .put(yossiLink)
    .send({ slotIds: [first.id] });
  assert.equal(taken.status, 409, taken.text);
  assert.match(taken.body.message, /כבר מלאה/);

  const cleared = await request(app.getHttpServer()).put(danaLink).send({ slotIds: [] });
  assert.equal(cleared.status, 200, cleared.text);
  assert.equal(
    cleared.body.slots.some((slot: { mine: boolean }) => slot.mine),
    false,
  );
});

test('a tampered or expired link is refused', async () => {
  const shop = await shopWithWeek();
  const good = pickToken(shop.tenantId, shop.workers[0] as string);
  const tampered = await request(app.getHttpServer()).get(`/api/v1/pick/${good.slice(0, -2)}xx`);
  assert.equal(tampered.status, 404, tampered.text);
  const old = pickToken(shop.tenantId, shop.workers[0] as string, Date.now() - 30 * 86_400_000);
  const expired = await request(app.getHttpServer()).get(`/api/v1/pick/${old}`);
  assert.equal(expired.status, 404, expired.text);
});
