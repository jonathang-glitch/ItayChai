import { DEV_TENANT_ID, WHATSAPP_PROVIDER } from '@itay-chai/contracts';
import { prisma } from './index.js';
import {
  DANA_EMPLOYEE_ID,
  DANA_SEED_SHIFTS,
  ORI_EMPLOYEE_ID,
  ROI_EMPLOYEE_ID,
  YOSSI_SEED_SHIFTS,
  SEED_SHIFTS,
  SHIRA_EMPLOYEE_ID,
  TEL_AVIV_STORE_ID,
  YOSSI_EMPLOYEE_ID,
} from './seed-roster.js';
import { seekingMessage } from './shift-copy.js';

const ORI_USER = '00000000-0000-4000-8000-000000000015';
const DANA_USER = '00000000-0000-4000-8000-000000000016';
const YOSSI_USER = '00000000-0000-4000-8000-000000000017';

async function story(input: {
  sessionId: string;
  userId: string;
  employeeId: string;
  shiftId: string;
  kind: 'COVER' | 'SWAP';
  text: string;
  seeking: string;
  sent: string;
  offers: { employeeId: string; allowCover: boolean; allowSwap: boolean }[];
}) {
  await prisma.agentSession.create({
    data: {
      id: input.sessionId,
      tenantId: DEV_TENANT_ID,
      businessUnitId: TEL_AVIV_STORE_ID,
      customerUserId: input.userId,
      externalMessageId: `demo:${input.sessionId}`,
      status: 'DRAFT',
    },
  });
  await prisma.message.createMany({
    data: [
      {
        tenantId: DEV_TENANT_ID,
        sessionId: input.sessionId,
        direction: 'INBOUND',
        channel: WHATSAPP_PROVIDER,
        body: input.text,
      },
      {
        tenantId: DEV_TENANT_ID,
        sessionId: input.sessionId,
        direction: 'OUTBOUND',
        channel: WHATSAPP_PROVIDER,
        body: 'הבקשה נקלטה.',
      },
      {
        tenantId: DEV_TENANT_ID,
        sessionId: input.sessionId,
        direction: 'OUTBOUND',
        channel: WHATSAPP_PROVIDER,
        body: input.seeking,
      },
      {
        tenantId: DEV_TENANT_ID,
        sessionId: input.sessionId,
        direction: 'OUTBOUND',
        channel: WHATSAPP_PROVIDER,
        body: input.sent,
      },
    ],
  });
  const request = await prisma.shiftSwapRequest.create({
    data: {
      tenantId: DEV_TENANT_ID,
      sessionId: input.sessionId,
      employeeId: input.employeeId,
      shiftId: input.shiftId,
      kind: input.kind,
      intentText: input.text,
      requestedLabel: input.text,
      status: 'SEEKING',
    },
  });
  await prisma.shiftOffer.createMany({
    data: input.offers.map((offer) => ({
      tenantId: DEV_TENANT_ID,
      requestId: request.id,
      employeeId: offer.employeeId,
      allowCover: offer.allowCover,
      allowSwap: offer.allowSwap,
      status: 'PENDING',
    })),
  });
}

export async function seedDemoStories() {
  await story({
    sessionId: '00000000-0000-4000-8000-000000000081',
    userId: ORI_USER,
    employeeId: ORI_EMPLOYEE_ID,
    shiftId: SEED_SHIFTS[0].id,
    kind: 'SWAP',
    text: 'צריך החלפה בשישי בבוקר',
    seeking: seekingMessage('SWAP', 'שישי בבוקר'),
    sent: 'נשלח לדנה, יוסי, רועי',
    offers: [
      { employeeId: DANA_EMPLOYEE_ID, allowCover: false, allowSwap: true },
      { employeeId: YOSSI_EMPLOYEE_ID, allowCover: false, allowSwap: true },
      { employeeId: ROI_EMPLOYEE_ID, allowCover: false, allowSwap: true },
    ],
  });
  await story({
    sessionId: '00000000-0000-4000-8000-000000000082',
    userId: DANA_USER,
    employeeId: DANA_EMPLOYEE_ID,
    shiftId: DANA_SEED_SHIFTS[0].id,
    kind: 'COVER',
    text: 'צריכה מחליף בראשון בערב',
    seeking: seekingMessage('COVER', 'ראשון בערב'),
    sent: 'נשלח ליוסי, רועי, שירה',
    offers: [
      { employeeId: YOSSI_EMPLOYEE_ID, allowCover: true, allowSwap: false },
      { employeeId: ROI_EMPLOYEE_ID, allowCover: true, allowSwap: false },
      { employeeId: SHIRA_EMPLOYEE_ID, allowCover: true, allowSwap: false },
    ],
  });
  await story({
    sessionId: '00000000-0000-4000-8000-000000000083',
    userId: YOSSI_USER,
    employeeId: YOSSI_EMPLOYEE_ID,
    shiftId: YOSSI_SEED_SHIFTS[0].id,
    kind: 'COVER',
    text: 'צריך מחליף בשבת בבוקר',
    seeking: seekingMessage('COVER', 'שבת בבוקר'),
    sent: 'נשלח לדנה, רועי',
    offers: [
      { employeeId: DANA_EMPLOYEE_ID, allowCover: true, allowSwap: false },
      { employeeId: ROI_EMPLOYEE_ID, allowCover: true, allowSwap: false },
    ],
  });
}
