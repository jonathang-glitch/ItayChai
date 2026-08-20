import type { PrismaClient } from '@prisma/client';
import { DEV_TENANT_ID, MOCK_WHATSAPP_REPLY, WHATSAPP_PROVIDER } from '@itay-chai/contracts';

const ORI_USER_ID = '00000000-0000-4000-8000-000000000015';

export const TEL_AVIV_STORE_ID = '00000000-0000-4000-8000-000000000021';
export const ORI_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000031';
export const DEMO_SHIFT_REQUEST_SESSION_ID = '00000000-0000-4000-8000-000000000051';

export const SEED_SHIFTS = [
  {
    id: '00000000-0000-4000-8000-000000000042',
    label: 'בוקר שישי',
    startsAt: new Date('2026-08-21T08:00:00+03:00'),
    endsAt: new Date('2026-08-21T14:00:00+03:00'),
  },
  {
    id: '00000000-0000-4000-8000-000000000044',
    label: 'ערב שבת',
    startsAt: new Date('2026-08-22T16:00:00+03:00'),
    endsAt: new Date('2026-08-22T22:00:00+03:00'),
  },
  {
    id: '00000000-0000-4000-8000-000000000043',
    label: 'בוקר ראשון',
    startsAt: new Date('2026-08-23T08:00:00+03:00'),
    endsAt: new Date('2026-08-23T14:00:00+03:00'),
  },
  {
    id: '00000000-0000-4000-8000-000000000045',
    label: 'ערב שני',
    startsAt: new Date('2026-08-24T16:00:00+03:00'),
    endsAt: new Date('2026-08-24T22:00:00+03:00'),
  },
  {
    id: '00000000-0000-4000-8000-000000000046',
    label: 'בוקר שלישי',
    startsAt: new Date('2026-08-25T08:00:00+03:00'),
    endsAt: new Date('2026-08-25T14:00:00+03:00'),
  },
] as const;

export async function seedRoster(db: PrismaClient) {
  await db.employee.upsert({
    where: { id: ORI_EMPLOYEE_ID },
    create: {
      id: ORI_EMPLOYEE_ID,
      tenantId: DEV_TENANT_ID,
      businessUnitId: TEL_AVIV_STORE_ID,
      userId: ORI_USER_ID,
      displayName: 'אורי',
      roleLabel: 'מוכר',
    },
    update: {
      displayName: 'אורי',
      roleLabel: 'מוכר',
      businessUnitId: TEL_AVIV_STORE_ID,
    },
  });

  for (const shift of SEED_SHIFTS) {
    await db.shift.upsert({
      where: { id: shift.id },
      create: {
        id: shift.id,
        tenantId: DEV_TENANT_ID,
        businessUnitId: TEL_AVIV_STORE_ID,
        employeeId: ORI_EMPLOYEE_ID,
        label: shift.label,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      },
      update: {
        label: shift.label,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      },
    });
  }

  await db.shift.deleteMany({
    where: {
      employeeId: ORI_EMPLOYEE_ID,
      id: { notIn: SEED_SHIFTS.map((shift) => shift.id) },
    },
  });
}

export async function seedDemoShiftRequest(db: PrismaClient) {
  const shift = SEED_SHIFTS[0];
  const text = `צריך החלפה ב${shift.label}`;
  const externalMessageId = `web:${ORI_USER_ID}:seed-thursday`;

  await db.webhookReceipt.create({
    data: {
      id: '00000000-0000-4000-8000-000000000081',
      tenantId: DEV_TENANT_ID,
      provider: WHATSAPP_PROVIDER,
      externalMessageId,
    },
  });
  await db.inboxMessage.create({
    data: {
      id: '00000000-0000-4000-8000-000000000082',
      tenantId: DEV_TENANT_ID,
      provider: WHATSAPP_PROVIDER,
      externalMessageId,
    },
  });
  await db.agentSession.create({
    data: {
      id: DEMO_SHIFT_REQUEST_SESSION_ID,
      tenantId: DEV_TENANT_ID,
      businessUnitId: TEL_AVIV_STORE_ID,
      customerUserId: ORI_USER_ID,
      status: 'COMPLETED',
      version: 1,
      externalMessageId,
    },
  });
  await db.message.createMany({
    data: [
      {
        id: '00000000-0000-4000-8000-000000000071',
        tenantId: DEV_TENANT_ID,
        sessionId: DEMO_SHIFT_REQUEST_SESSION_ID,
        direction: 'INBOUND',
        channel: WHATSAPP_PROVIDER,
        body: text,
      },
      {
        id: '00000000-0000-4000-8000-000000000072',
        tenantId: DEV_TENANT_ID,
        sessionId: DEMO_SHIFT_REQUEST_SESSION_ID,
        direction: 'OUTBOUND',
        channel: WHATSAPP_PROVIDER,
        body: MOCK_WHATSAPP_REPLY,
      },
    ],
  });
  await db.shiftSwapRequest.create({
    data: {
      id: '00000000-0000-4000-8000-000000000061',
      tenantId: DEV_TENANT_ID,
      sessionId: DEMO_SHIFT_REQUEST_SESSION_ID,
      employeeId: ORI_EMPLOYEE_ID,
      shiftId: shift.id,
      intentText: text,
      requestedLabel: shift.label,
      status: 'OPEN',
    },
  });
}
