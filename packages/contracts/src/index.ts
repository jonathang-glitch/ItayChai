import { z } from 'zod';

export const DEV_TENANT_ID = '00000000-0000-4000-8000-000000000001';
export const SECOND_TENANT_ID = '00000000-0000-4000-8000-000000000002';

export const PERMISSIONS = {
  SESSION_READ: 'session.read',
  SESSION_WRITE: 'session.write',
  TENANT_MANAGE: 'tenant.manage',
  CUSTOMER_WRITE: 'customer.write',
  BREAK_GLASS: 'ops.break_glass',
  DLQ_REPLAY: 'ops.dlq',
} as const;

export const ROLE_NAMES = {
  OWNER: 'owner',
  STAKEHOLDER: 'stakeholder',
  CUSTOMER: 'customer',
  OPS_ADMIN: 'ops_admin',
  SERVICE: 'service',
} as const;

export function customerRequestPrefix(userId: string) {
  return `web:${userId}:`;
}

export function shiftLabelFromStart(startsAt: Date | string) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const weekday = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
  })
    .format(date)
    .replace(/^יום\s+/, '');
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jerusalem',
    }).format(date),
  );
  return `${weekday} ${hour < 15 ? 'בבוקר' : 'בערב'}`;
}

export function phraseShiftLabel(label: string) {
  const trimmed = label.trim();
  const morning = trimmed.match(/^בוקר\s+(.+)$/);
  if (morning) {
    return `${morning[1]} בבוקר`;
  }
  const evening = trimmed.match(/^ערב\s+(.+)$/);
  if (evening) {
    return `${evening[1]} בערב`;
  }
  return trimmed;
}

export function phraseShiftTalk(text: string) {
  return text
    .replace(/בבוקר\s+(?![\d(])(\S+)/g, 'ב$1 בבוקר')
    .replace(/בערב\s+(?![\d(])(\S+)/g, 'ב$1 בערב')
    .replace(/בוקר\s+(?![\d(])(\S+)/g, '$1 בבוקר')
    .replace(/ערב\s+(?![\d(])(\S+)/g, '$1 בערב');
}

export function swapRequestText(label: string) {
  return `צריך החלפה ב${phraseShiftLabel(label)}`;
}

export function requestIntentText(kind: 'COVER' | 'SWAP' | 'EITHER', label: string) {
  if (kind === 'COVER') {
    return `צריך מחליף ב${phraseShiftLabel(label)}`;
  }
  if (kind === 'SWAP') {
    return `צריך החלפה ב${phraseShiftLabel(label)}`;
  }
  return `צריך כיסוי או החלפה ב${phraseShiftLabel(label)}`;
}

export function jerusalemDayKey(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function jerusalemWeekday(value: Date | string) {
  const name = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(typeof value === 'string' ? new Date(value) : value);
  return WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number]);
}

export function jerusalemWeekKey(value: Date | string) {
  const day = jerusalemDayKey(value);
  const [year, month, date] = day.split('-').map(Number);
  const start = Date.UTC(year, month - 1, date) - jerusalemWeekday(value) * 86_400_000;
  const sunday = new Date(start);
  return `${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth() + 1).padStart(2, '0')}-${String(sunday.getUTCDate()).padStart(2, '0')}`;
}

export const SHIFT_REQUEST_KINDS = ['COVER', 'SWAP', 'EITHER'] as const;
export type ShiftRequestKind = (typeof SHIFT_REQUEST_KINDS)[number];
export const SHIFT_OFFER_ACTIONS = ['cover', 'swap', 'decline'] as const;
export type ShiftOfferAction = (typeof SHIFT_OFFER_ACTIONS)[number];
export const SHIFT_MATCH_ACTIONS = ['accept', 'decline'] as const;
export type ShiftMatchAction = (typeof SHIFT_MATCH_ACTIONS)[number];
export const SHIFT_DECISIONS = ['approve', 'reject', 'needs_replacement'] as const;
export type ShiftDecision = (typeof SHIFT_DECISIONS)[number];
export const MOCK_WHATSAPP_REPLY = 'Your request was received.';
export const WHATSAPP_PROVIDER = 'whatsapp';
export const AGENT_SESSION_QUEUE = 'agent-session';
export const AGENT_SESSION_REQUESTED = 'AgentSessionRequested';
export const RELIABILITY_QUARANTINE_REQUESTED = 'ReliabilityQuarantineRequested';

export const mockWhatsAppWebhookSchema = z.object({
  externalMessageId: z.string().min(1),
  text: z.string().optional(),
});

export type MockWhatsAppWebhook = z.infer<typeof mockWhatsAppWebhookSchema>;

export type AgentSessionRequestedPayload = {
  eventType: typeof AGENT_SESSION_REQUESTED;
  tenantId: string;
  sessionId: string;
  eventId: string;
  correlationId: string;
  externalMessageId: string;
};
