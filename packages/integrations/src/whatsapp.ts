import { createHmac, timingSafeEqual } from 'node:crypto';
import { MOCK_WHATSAPP_REPLY } from '@itay-chai/contracts';
import type { WhatsAppButton } from '@itay-chai/contracts';
import { parseTwilioInbound, TwilioWhatsAppAdapter } from './whatsapp-twilio.js';

export type WhatsAppSendInput = {
  to: string;
  text: string;
  buttons?: WhatsAppButton[];
};

export type WhatsAppSendResult = {
  providerMessageId: string;
};

export type WhatsAppInbound = {
  externalMessageId: string;
  from: string;
  text?: string;
  buttonId?: string;
};

export type WhatsAppAdapter = {
  reply(text?: string): Promise<{ body: string }>;
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
  verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): boolean;
  parseInbound(payload: unknown): WhatsAppInbound | null;
};

type RecordedSend = WhatsAppSendInput & WhatsAppSendResult;

const recorded: RecordedSend[] = [];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function parseMockInbound(payload: unknown): WhatsAppInbound | null {
  const body = asRecord(payload);
  if (!body || typeof body.externalMessageId !== 'string' || typeof body.from !== 'string') {
    return null;
  }
  return {
    externalMessageId: body.externalMessageId,
    from: body.from,
    ...(typeof body.text === 'string' ? { text: body.text } : {}),
    ...(typeof body.buttonId === 'string' ? { buttonId: body.buttonId } : {}),
  };
}

function parseMetaInbound(payload: unknown): WhatsAppInbound | null {
  const root = asRecord(payload);
  if (root?.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) {
    return null;
  }
  const entry = asRecord(root.entry[0]);
  const change = Array.isArray(entry?.changes) ? asRecord(entry.changes[0]) : null;
  const value = asRecord(change?.value);
  const messages = Array.isArray(value?.messages) ? value.messages : [];
  const message = asRecord(messages[0]);
  if (!message || typeof message.id !== 'string' || typeof message.from !== 'string') {
    return null;
  }
  const textBody = asRecord(message.text);
  const interactive = asRecord(message.interactive);
  const buttonReply = asRecord(interactive?.button_reply) ?? asRecord(interactive?.list_reply);
  const button = asRecord(message.button);
  const buttonId =
    (typeof buttonReply?.id === 'string' && buttonReply.id) ||
    (typeof button?.payload === 'string' && button.payload) ||
    undefined;
  const text =
    (typeof textBody?.body === 'string' && textBody.body) ||
    (typeof buttonReply?.title === 'string' && buttonReply.title) ||
    (typeof button?.text === 'string' && button.text) ||
    undefined;
  return {
    externalMessageId: message.id,
    from: message.from,
    ...(text ? { text } : {}),
    ...(buttonId ? { buttonId } : {}),
  };
}

export class MockWhatsAppAdapter implements WhatsAppAdapter {
  async reply(): Promise<{ body: string }> {
    return { body: MOCK_WHATSAPP_REPLY };
  }

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const providerMessageId = `mock:${recorded.length + 1}`;
    recorded.push({ ...input, providerMessageId });
    return { providerMessageId };
  }

  verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): boolean {
    if ((process.env.WHATSAPP_PROVIDER ?? 'mock') === 'mock') {
      return true;
    }
    const secret = process.env.META_WHATSAPP_APP_SECRET;
    const signature = headers['x-hub-signature-256'];
    if (!secret || !signature?.startsWith('sha256=')) {
      return false;
    }
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  parseInbound(payload: unknown): WhatsAppInbound | null {
    return parseMockInbound(payload) ?? parseMetaInbound(payload) ?? parseTwilioInbound(payload);
  }
}

export const mockWhatsAppAdapter = new MockWhatsAppAdapter();

export function recordedWhatsAppSends(): RecordedSend[] {
  return [...recorded];
}

export function clearRecordedWhatsAppSends() {
  recorded.length = 0;
}

export function createWhatsAppAdapter(): WhatsAppAdapter {
  const provider = process.env.WHATSAPP_PROVIDER ?? 'mock';
  if (provider === 'mock') {
    return mockWhatsAppAdapter;
  }
  if (provider === 'twilio') {
    return new TwilioWhatsAppAdapter();
  }
  throw new Error(`WhatsApp provider ${provider} is not wired yet`);
}
