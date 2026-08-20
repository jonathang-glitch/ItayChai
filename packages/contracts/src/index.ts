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
