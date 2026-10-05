import { createHmac, timingSafeEqual } from 'node:crypto';
import { MOCK_WHATSAPP_REPLY } from '@itay-chai/contracts';
import type { WhatsAppAdapter, WhatsAppInbound, WhatsAppSendInput, WhatsAppSendResult } from './whatsapp.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function asWhatsAppAddress(raw: string) {
  const trimmed = raw.trim();
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

export function parseTwilioInbound(payload: unknown): WhatsAppInbound | null {
  const body = asRecord(payload);
  if (!body || typeof body.MessageSid !== 'string' || typeof body.From !== 'string') {
    return null;
  }
  if (!String(body.From).startsWith('whatsapp:')) {
    return null;
  }
  const text = typeof body.Body === 'string' ? body.Body : undefined;
  const buttonId =
    (typeof body.ButtonPayload === 'string' && body.ButtonPayload) ||
    (typeof body.ButtonText === 'string' && body.ButtonText) ||
    undefined;
  return {
    externalMessageId: body.MessageSid,
    from: body.From.replace(/^whatsapp:/, ''),
    ...(text ? { text } : {}),
    ...(buttonId ? { buttonId } : {}),
  };
}

function basicAuth(accountSid: string, secret: string) {
  return `Basic ${Buffer.from(`${accountSid}:${secret}`).toString('base64')}`;
}

function twilioCode(error: unknown) {
  if (error && typeof error === 'object' && 'twilioCode' in error) {
    return Number((error as { twilioCode?: number }).twilioCode);
  }
  return undefined;
}

function digits(raw: string) {
  return raw.replace(/^whatsapp:/, '').replace(/[^\d+]/g, '');
}

function routeFor(to: string) {
  const dest = digits(to);
  for (const raw of [process.env.TWILIO_WHATSAPP_ROUTE_1, process.env.TWILIO_WHATSAPP_ROUTE_2]) {
    if (!raw) {
      continue;
    }
    const [recipient, from, contentSid] = raw.split(',').map((part) => part.trim());
    if (recipient && from && digits(recipient) === dest) {
      return { from, contentSid: contentSid || process.env.TWILIO_WHATSAPP_CONTENT_SID };
    }
  }
  return {
    from: process.env.TWILIO_WHATSAPP_FROM,
    contentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID,
  };
}

export function verifyTwilioSignature(input: {
  url: string;
  params: Record<string, string>;
  signature: string | undefined;
  authToken: string | undefined;
}) {
  if (!input.authToken || !input.signature || !input.url) {
    return false;
  }
  const payload = Object.keys(input.params)
    .sort()
    .reduce((url, key) => `${url}${key}${input.params[key]}`, input.url);
  const expected = createHmac('sha1', input.authToken).update(payload, 'utf8').digest('base64');
  const left = Buffer.from(input.signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function paramsFromRaw(rawBody: string) {
  if (!rawBody) {
    return null;
  }
  try {
    if (rawBody.startsWith('{')) {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== 'string') {
          return null;
        }
        params[key] = value;
      }
      return params;
    }
    return Object.fromEntries(new URLSearchParams(rawBody));
  } catch {
    return null;
  }
}

export class TwilioWhatsAppAdapter implements WhatsAppAdapter {
  async reply(): Promise<{ body: string }> {
    return { body: MOCK_WHATSAPP_REPLY };
  }

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const route = routeFor(input.to);
    const from = route.from;
    if (!accountSid || !token || !from) {
      throw new Error('Twilio WhatsApp is missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM');
    }
    const contentSid = route.contentSid;
    try {
      return await this.postMessage(accountSid, token, {
        To: asWhatsAppAddress(input.to),
        From: from,
        Body: input.text,
      });
    } catch (error) {
      if (!contentSid) {
        throw error;
      }
      const code = twilioCode(error);
      const message = error instanceof Error ? error.message : '';
      if (code !== 63016 && !/content\s*sid/i.test(message)) {
        throw error;
      }
    }
    if (!contentSid) {
      throw new Error('Twilio WhatsApp template is required outside the 24h window');
    }
    return this.postMessage(accountSid, token, {
      To: asWhatsAppAddress(input.to),
      From: from,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify({ '1': input.text }),
    });
  }

  verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): boolean {
    const params = paramsFromRaw(rawBody);
    if (!params) {
      return false;
    }
    return verifyTwilioSignature({
      url: headers['x-request-url'] ?? '',
      params,
      signature: headers['x-twilio-signature'],
      authToken: process.env.TWILIO_AUTH_TOKEN,
    });
  }

  parseInbound(payload: unknown): WhatsAppInbound | null {
    return parseTwilioInbound(payload);
  }

  private async postMessage(
    accountSid: string,
    token: string,
    fields: Record<string, string>,
  ): Promise<WhatsAppSendResult> {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(accountSid, token),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(fields),
    });
    const json = (await response.json()) as { sid?: string; message?: string; code?: number };
    if (!response.ok || !json.sid) {
      const error = new Error(json.message ?? `Twilio send failed (${response.status})`) as Error & {
        twilioCode?: number;
      };
      if (typeof json.code === 'number') {
        error.twilioCode = json.code;
      }
      throw error;
    }
    return { providerMessageId: json.sid };
  }
}
