import type { PrismaClient } from '@prisma/client';
import { DEV_TENANT_ID, jerusalemDayKey, shiftLabelFromStart } from '@itay-chai/contracts';

const ORI_USER_ID = '00000000-0000-4000-8000-000000000015';
const DANA_USER_ID = '00000000-0000-4000-8000-000000000016';
const YOSSI_USER_ID = '00000000-0000-4000-8000-000000000017';
const ROI_USER_ID = '00000000-0000-4000-8000-000000000018';
const SHIRA_USER_ID = '00000000-0000-4000-8000-000000000019';

export const TEL_AVIV_STORE_ID = '00000000-0000-4000-8000-000000000021';
export const ORI_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000031';
export const DANA_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000032';
export const YOSSI_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000033';
export const MICHAL_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000034';
export const ROI_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000035';
export const SHIRA_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000036';

function slot(id: string, start: string, end: string) {
  return { id, startsAt: new Date(start), endsAt: new Date(end) };
}

export const SEED_SHIFTS = [
  slot('00000000-0000-4000-8000-000000000042', '2026-08-28T08:00:00+03:00', '2026-08-28T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000044', '2026-08-29T16:00:00+03:00', '2026-08-29T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000043', '2026-08-30T08:00:00+03:00', '2026-08-30T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000045', '2026-08-31T16:00:00+03:00', '2026-08-31T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000046', '2026-09-01T08:00:00+03:00', '2026-09-01T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000053', '2026-09-04T08:00:00+03:00', '2026-09-04T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000057', '2026-09-06T08:00:00+03:00', '2026-09-06T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000058', '2026-09-08T16:00:00+03:00', '2026-09-08T22:00:00+03:00'),
] as const;

export const DANA_SEED_SHIFTS = [
  slot('00000000-0000-4000-8000-000000000047', '2026-08-30T16:00:00+03:00', '2026-08-30T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000050', '2026-09-04T16:00:00+03:00', '2026-09-04T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000055', '2026-09-02T16:00:00+03:00', '2026-09-02T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000059', '2026-08-31T08:00:00+03:00', '2026-08-31T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000060', '2026-09-06T16:00:00+03:00', '2026-09-06T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000061', '2026-09-10T08:00:00+03:00', '2026-09-10T14:00:00+03:00'),
] as const;

export const DANA_FREE_SHIFT = DANA_SEED_SHIFTS[2];

export const YOSSI_SEED_SHIFTS = [
  slot('00000000-0000-4000-8000-000000000048', '2026-08-29T08:00:00+03:00', '2026-08-29T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000052', '2026-09-05T08:00:00+03:00', '2026-09-05T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000062', '2026-09-02T08:00:00+03:00', '2026-09-02T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000063', '2026-09-07T08:00:00+03:00', '2026-09-07T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000064', '2026-09-09T16:00:00+03:00', '2026-09-09T22:00:00+03:00'),
] as const;

export const MICHAL_SEED_SHIFTS = [
  slot('00000000-0000-4000-8000-000000000049', '2026-08-28T08:00:00+03:00', '2026-08-28T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000065', '2026-09-01T16:00:00+03:00', '2026-09-01T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000066', '2026-09-03T08:00:00+03:00', '2026-09-03T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000067', '2026-09-07T16:00:00+03:00', '2026-09-07T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000068', '2026-09-10T16:00:00+03:00', '2026-09-10T22:00:00+03:00'),
] as const;

export const ROI_SEED_SHIFTS = [
  slot('00000000-0000-4000-8000-000000000056', '2026-09-03T16:00:00+03:00', '2026-09-03T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000069', '2026-09-05T16:00:00+03:00', '2026-09-05T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000070', '2026-09-08T08:00:00+03:00', '2026-09-08T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000071', '2026-09-06T08:00:00+03:00', '2026-09-06T14:00:00+03:00'),
] as const;

export const SHIRA_SEED_SHIFTS = [
  slot('00000000-0000-4000-8000-000000000054', '2026-08-29T16:00:00+03:00', '2026-08-29T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000072', '2026-09-02T08:00:00+03:00', '2026-09-02T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000073', '2026-09-05T16:00:00+03:00', '2026-09-05T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-000000000074', '2026-09-09T08:00:00+03:00', '2026-09-09T14:00:00+03:00'),
] as const;

export const LIVE_DANA_SHIFTS = [
  slot('00000000-0000-4000-8000-0000000000a1', '2026-09-24T16:00:00+03:00', '2026-09-24T22:00:00+03:00'),
  slot('00000000-0000-4000-8000-0000000000a2', '2026-09-27T16:00:00+03:00', '2026-09-27T22:00:00+03:00'),
] as const;

export const LIVE_YOSSI_SHIFTS = [
  slot('00000000-0000-4000-8000-0000000000b1', '2026-09-25T08:00:00+03:00', '2026-09-25T14:00:00+03:00'),
  slot('00000000-0000-4000-8000-0000000000b2', '2026-09-26T16:00:00+03:00', '2026-09-26T22:00:00+03:00'),
] as const;

const PEOPLE = [
  { id: ORI_EMPLOYEE_ID, userId: ORI_USER_ID, displayName: 'אורי', shifts: SEED_SHIFTS },
  { id: DANA_EMPLOYEE_ID, userId: DANA_USER_ID, displayName: 'דנה', shifts: DANA_SEED_SHIFTS },
  { id: YOSSI_EMPLOYEE_ID, userId: YOSSI_USER_ID, displayName: 'יוסי', shifts: YOSSI_SEED_SHIFTS },
  { id: MICHAL_EMPLOYEE_ID, userId: null, displayName: 'מיכל', shifts: MICHAL_SEED_SHIFTS },
  { id: ROI_EMPLOYEE_ID, userId: ROI_USER_ID, displayName: 'רועי', shifts: ROI_SEED_SHIFTS },
  { id: SHIRA_EMPLOYEE_ID, userId: SHIRA_USER_ID, displayName: 'שירה', shifts: SHIRA_SEED_SHIFTS },
] as const;

const LIVE_PEOPLE = [
  { id: DANA_EMPLOYEE_ID, userId: DANA_USER_ID, displayName: 'דנה', shifts: LIVE_DANA_SHIFTS },
  { id: YOSSI_EMPLOYEE_ID, userId: YOSSI_USER_ID, displayName: 'יוסי', shifts: LIVE_YOSSI_SHIFTS },
] as const;

export function isLiveWhatsAppRoster() {
  return (process.env.WHATSAPP_PROVIDER ?? 'mock') === 'twilio';
}

export async function pruneWorkersWithoutWhatsApp(db: PrismaClient) {
  if (!isLiveWhatsAppRoster()) {
    return;
  }
  const drop = [ORI_EMPLOYEE_ID, MICHAL_EMPLOYEE_ID, ROI_EMPLOYEE_ID, SHIRA_EMPLOYEE_ID];
  await db.shift.deleteMany({ where: { tenantId: DEV_TENANT_ID, employeeId: { in: drop } } });
  await db.employee.deleteMany({ where: { tenantId: DEV_TENANT_ID, id: { in: drop } } });
  const keepIds = [...LIVE_DANA_SHIFTS, ...LIVE_YOSSI_SHIFTS].map((shift) => shift.id);
  await db.shift.deleteMany({
    where: {
      tenantId: DEV_TENANT_ID,
      employeeId: { in: [DANA_EMPLOYEE_ID, YOSSI_EMPLOYEE_ID] },
      id: { notIn: keepIds },
    },
  });
}

function assertOneShiftPerDay(
  people: readonly { displayName: string; shifts: readonly { startsAt: Date }[] }[],
) {
  for (const person of people) {
    const days = person.shifts.map((shift) => jerusalemDayKey(shift.startsAt));
    if (new Set(days).size !== days.length) {
      throw new Error(`${person.displayName} has two shifts on the same day`);
    }
  }
}

export async function seedRoster(db: PrismaClient) {
  const people = isLiveWhatsAppRoster() ? LIVE_PEOPLE : PEOPLE;
  assertOneShiftPerDay(people);
  const keepIds = people.flatMap((person) => person.shifts.map((shift) => shift.id));

  for (const person of people) {
    await db.employee.upsert({
      where: { id: person.id },
      create: {
        id: person.id,
        tenantId: DEV_TENANT_ID,
        businessUnitId: TEL_AVIV_STORE_ID,
        userId: person.userId,
        displayName: person.displayName,
        roleLabel: 'מוכר',
      },
      update: {
        displayName: person.displayName,
        roleLabel: 'מוכר',
        businessUnitId: TEL_AVIV_STORE_ID,
        userId: person.userId,
      },
    });
    for (const shift of person.shifts) {
      await db.shift.upsert({
        where: { id: shift.id },
        create: {
          id: shift.id,
          tenantId: DEV_TENANT_ID,
          businessUnitId: TEL_AVIV_STORE_ID,
          employeeId: person.id,
          label: shiftLabelFromStart(shift.startsAt),
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
        },
        update: {
          employeeId: person.id,
          label: shiftLabelFromStart(shift.startsAt),
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
        },
      });
    }
  }

  await db.shift.deleteMany({
    where: {
      tenantId: DEV_TENANT_ID,
      employeeId: { in: people.map((person) => person.id) },
      id: { notIn: keepIds },
    },
  });
}
