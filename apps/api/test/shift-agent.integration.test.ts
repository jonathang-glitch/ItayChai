import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEV_TENANT_ID } from '@itay-chai/contracts';
import {
  DANA_EMPLOYEE_ID,
  DANA_FREE_SHIFT,
  ORI_EMPLOYEE_ID,
  DANA_SEED_SHIFTS,
  prisma,
  resetClientInbox,
  seedIdentity,
  SEED_PASSWORD,
  SEED_SHIFTS,
  SEED_USERS,
  YOSSI_SEED_SHIFTS,
} from '@itay-chai/database';
import { AppModule } from '../src/app.module.js';

let app: INestApplication;
let oriToken: string;
let danaToken: string;
let yossiToken: string;

before(async () => {
  await seedIdentity();
  await resetClientInbox();
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  oriToken = await login(SEED_USERS.customerA.email);
  danaToken = await login(SEED_USERS.danaA.email);
  yossiToken = await login(SEED_USERS.yossiA.email);
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function login(email: string) {
  const result = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: SEED_PASSWORD });
  assert.equal(result.status, 200, result.text);
  return result.body.accessToken as string;
}

function as(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': DEV_TENANT_ID,
  };
}

async function start(kind: 'COVER' | 'SWAP' | 'EITHER') {
  await seedIdentity();
  await resetClientInbox();
  const created = await request(app.getHttpServer())
    .post('/api/v1/customer/requests')
    .set(as(oriToken))
    .send({ shiftId: SEED_SHIFTS[0].id, kind });
  assert.equal(created.status, 201, created.text);
  return created.body as {
    id: string;
    shiftRequest: { status: string; kind: string; offers: { employeeName: string }[] };
  };
}

async function home(token: string) {
  const result = await request(app.getHttpServer()).get('/api/v1/customer/requests/home').set(as(token));
  assert.equal(result.status, 200, result.text);
  return result.body as {
    shifts: { id: string }[];
    offers: {
      id: string;
      status?: string;
      result?: string | null;
      allowCover: boolean;
      allowSwap: boolean;
      requesterName: string;
      swapChoices?: { id: string }[];
    }[];
  };
}

test('cover: first yes takes Friday and cancels the other offer', async () => {
  const created = await start('COVER');
  assert.equal(created.shiftRequest.status, 'SEEKING');
  assert.equal(created.shiftRequest.kind, 'COVER');
  const names = created.shiftRequest.offers.map((offer) => offer.employeeName).sort();
  assert.deepEqual(names, ['דנה', 'יוסי', 'רועי', 'שירה']);

  const danaHome = await home(danaToken);
  const yossiHome = await home(yossiToken);
  assert.equal(danaHome.offers.length, 1);
  assert.equal(danaHome.offers[0].allowCover, true);
  assert.equal(danaHome.offers[0].allowSwap, false);
  assert.equal(yossiHome.offers.length, 1);
  assert.ok(!(await home(yossiToken)).offers.some((offer) => offer.requesterName === 'מיכל'));

  const accepted = await request(app.getHttpServer())
    .post(`/api/v1/customer/offers/${danaHome.offers[0].id}`)
    .set(as(danaToken))
    .send({ action: 'cover' });
  assert.equal(accepted.status, 200, accepted.text);

  const oriShifts = await home(oriToken);
  assert.ok(!oriShifts.shifts.some((shift) => shift.id === SEED_SHIFTS[0].id));
  const friday = await prisma.shift.findUnique({ where: { id: SEED_SHIFTS[0].id } });
  assert.equal(friday?.employeeId, DANA_EMPLOYEE_ID);
  const danaShifts = await home(danaToken);
  assert.ok(danaShifts.shifts.some((shift) => shift.id === SEED_SHIFTS[0].id));
  assert.ok(danaShifts.shifts.some((shift) => shift.id === DANA_SEED_SHIFTS[0].id));
  const danaCover = danaShifts.offers.find((offer) => offer.id === danaHome.offers[0].id);
  assert.match(danaCover?.result ?? '', /המשמרת אצלך/);
  const danaNote = await prisma.message.findFirst({
    where: { session: { customerUserId: SEED_USERS.danaA.id }, body: { contains: 'המשמרת אצלך' } },
  });
  assert.ok(danaNote, 'cover winner should get a confirmation');

  const yossiAfter = await home(yossiToken);
  assert.ok(!yossiAfter.offers.some((offer) => offer.id === yossiHome.offers[0].id));
  const yossiOffer = await prisma.shiftOffer.findUnique({ where: { id: yossiHome.offers[0].id } });
  assert.equal(yossiOffer?.status, 'CANCELLED');
});

test('swap: coworker yes then requester yes trades the two shifts', async () => {
  const created = await start('SWAP');
  assert.equal(created.shiftRequest.status, 'SEEKING');
  const names = created.shiftRequest.offers.map((offer) => offer.employeeName).sort();
  assert.deepEqual(names, ['דנה', 'יוסי', 'רועי']);
  const danaHome = await home(danaToken);
  assert.equal(danaHome.offers[0].allowSwap, true);
  assert.equal(danaHome.offers[0].allowCover, false);
  assert.ok(danaHome.offers[0].swapChoices?.some((shift) => shift.id === DANA_FREE_SHIFT.id));
  assert.ok(!danaHome.offers[0].swapChoices?.some((shift) => shift.id === DANA_SEED_SHIFTS[0].id));

  const proposed = await request(app.getHttpServer())
    .post(`/api/v1/customer/offers/${danaHome.offers[0].id}`)
    .set(as(danaToken))
    .send({ action: 'swap', proposedShiftId: DANA_FREE_SHIFT.id });
  assert.equal(proposed.status, 200, proposed.text);
  const danaWaiting = await home(danaToken);
  const waiting = danaWaiting.offers.find((offer) => offer.id === danaHome.offers[0].id);
  assert.equal(waiting?.status, 'ACCEPTED');
  assert.match(waiting?.result ?? '', /שאלנו את המבקש/);

  const oriHome = await request(app.getHttpServer()).get('/api/v1/customer/requests').set(as(oriToken));
  const row = (oriHome.body as { id: string; shiftRequest: { status: string } }[]).find((item) => item.id === created.id);
  assert.equal(row?.shiftRequest.status, 'MATCH_PROPOSED');

  const confirmed = await request(app.getHttpServer())
    .post(`/api/v1/customer/requests/${created.id}/match`)
    .set(as(oriToken))
    .send({ action: 'accept' });
  assert.equal(confirmed.status, 200, confirmed.text);
  const committed = (confirmed.body.requests as { id: string; shiftRequest: { status: string } }[]).find(
    (item) => item.id === created.id,
  );
  assert.equal(committed?.shiftRequest.status, 'COMMITTED');

  const friday = await prisma.shift.findUnique({ where: { id: SEED_SHIFTS[0].id } });
  const wednesday = await prisma.shift.findUnique({ where: { id: DANA_FREE_SHIFT.id } });
  assert.equal(friday?.employeeId, DANA_EMPLOYEE_ID);
  assert.equal(wednesday?.employeeId, ORI_EMPLOYEE_ID);
  const oriShifts = await home(oriToken);
  assert.ok(!oriShifts.shifts.some((shift) => shift.id === SEED_SHIFTS[0].id));
  assert.ok(oriShifts.shifts.some((shift) => shift.id === DANA_FREE_SHIFT.id));
  const danaShifts = await home(danaToken);
  assert.ok(danaShifts.shifts.some((shift) => shift.id === SEED_SHIFTS[0].id));
  assert.ok(!danaShifts.shifts.some((shift) => shift.id === DANA_FREE_SHIFT.id));
  const danaDone = danaShifts.offers.find((offer) => offer.id === danaHome.offers[0].id);
  assert.match(danaDone?.result ?? '', /אישר את ההחלפה/);
  const danaNote = await prisma.message.findFirst({
    where: { session: { customerUserId: SEED_USERS.danaA.id }, body: { contains: 'אישר את ההחלפה' } },
  });
  assert.ok(danaNote, 'swap counterpart should get a confirmation');
});

test('either: cover wins immediately and a later swap is not needed', async () => {
  const created = await start('EITHER');
  const danaHome = await home(danaToken);
  const yossiHome = await home(yossiToken);
  const roiHome = await home(await login(SEED_USERS.roiA.email));
  assert.equal(danaHome.offers[0].allowCover, true);
  assert.equal(danaHome.offers[0].allowSwap, true);
  assert.equal(yossiHome.offers[0].allowCover, true);
  assert.equal(yossiHome.offers[0].allowSwap, true);
  assert.equal(roiHome.offers[0].allowCover, true);
  assert.equal(roiHome.offers[0].allowSwap, true);

  const covered = await request(app.getHttpServer())
    .post(`/api/v1/customer/offers/${yossiHome.offers[0].id}`)
    .set(as(yossiToken))
    .send({ action: 'cover' });
  assert.equal(covered.status, 200, covered.text);

  const yossiShifts = await home(yossiToken);
  assert.ok(yossiShifts.shifts.some((shift) => shift.id === SEED_SHIFTS[0].id));
  assert.ok(yossiShifts.shifts.some((shift) => shift.id === YOSSI_SEED_SHIFTS[0].id));

  const list = await request(app.getHttpServer()).get('/api/v1/customer/requests').set(as(oriToken));
  const row = (list.body as { id: string; shiftRequest: { status: string } }[]).find((item) => item.id === created.id);
  assert.equal(row?.shiftRequest.status, 'COMMITTED');
});

test('either: refused swap commits the queued cover', async () => {
  const created = await start('EITHER');
  const danaHome = await home(danaToken);
  const yossiHome = await home(yossiToken);

  const proposed = await request(app.getHttpServer())
    .post(`/api/v1/customer/offers/${danaHome.offers[0].id}`)
    .set(as(danaToken))
    .send({ action: 'swap', proposedShiftId: DANA_FREE_SHIFT.id });
  assert.equal(proposed.status, 200, proposed.text);

  const queued = await request(app.getHttpServer())
    .post(`/api/v1/customer/offers/${yossiHome.offers[0].id}`)
    .set(as(yossiToken))
    .send({ action: 'cover' });
  assert.equal(queued.status, 200, queued.text);
  const yossiOffer = await prisma.shiftOffer.findUnique({ where: { id: yossiHome.offers[0].id } });
  assert.equal(yossiOffer?.status, 'QUEUED');
  assert.equal(yossiOffer?.allowCover, true);
  assert.equal(yossiOffer?.allowSwap, false);

  const refused = await request(app.getHttpServer())
    .post(`/api/v1/customer/requests/${created.id}/match`)
    .set(as(oriToken))
    .send({ action: 'decline' });
  assert.equal(refused.status, 200, refused.text);
  const committed = (refused.body.requests as { id: string; shiftRequest: { status: string } }[]).find(
    (item) => item.id === created.id,
  );
  assert.equal(committed?.shiftRequest.status, 'COMMITTED');

  const yossiShifts = await home(yossiToken);
  assert.ok(yossiShifts.shifts.some((shift) => shift.id === SEED_SHIFTS[0].id));
  const oriShifts = await home(oriToken);
  assert.ok(!oriShifts.shifts.some((shift) => shift.id === SEED_SHIFTS[0].id));
  assert.ok(!oriShifts.shifts.some((shift) => shift.id === DANA_SEED_SHIFTS[0].id));
});
