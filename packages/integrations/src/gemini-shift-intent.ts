import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const GEMINI_SHIFT_ACTIONS = [
  'show_roster',
  'start_cover',
  'start_swap',
  'start_either',
  'accept_match',
  'decline_match',
  'accept_cover',
  'accept_swap',
  'decline_offer',
  'cancel_search',
  'need_pick',
  'clarify',
] as const;

export type GeminiShiftAction = (typeof GEMINI_SHIFT_ACTIONS)[number];

export type GeminiShiftDecision = {
  action: GeminiShiftAction;
  shiftId?: string;
  reply?: string;
};

export type GeminiShiftContext = {
  text: string;
  shifts: { id: string; label: string }[];
  pendingOffer?: { allowCover: boolean; allowSwap: boolean; swapShiftIds: string[] };
  waitingConfirm?: boolean;
  openSearch?: boolean;
  recent?: { from: 'user' | 'bot'; text: string }[];
};

const ACTION_SET = new Set<string>(GEMINI_SHIFT_ACTIONS);

function envValue(name: string) {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) {
    return fromProcess;
  }
  if (process.env.NODE_ENV === 'test') {
    return '';
  }
  for (const rel of ['.env', '../../.env']) {
    try {
      const line = readFileSync(resolve(process.cwd(), rel), 'utf8')
        .split('\n')
        .find((row) => row.startsWith(`${name}=`));
      if (line) {
        return line.slice(name.length + 1).trim();
      }
    } catch {
      // keep looking
    }
  }
  return '';
}

export function geminiShiftConfigured() {
  if (process.env.NODE_ENV === 'test' && process.env.GEMINI_IN_TESTS !== '1') {
    return false;
  }
  return Boolean(envValue('GEMINI_API_KEY'));
}

export function parseGeminiShiftDecision(raw: string, allowedShiftIds: string[]): GeminiShiftDecision | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const row = parsed as { action?: unknown; shiftId?: unknown; reply?: unknown };
  if (typeof row.action !== 'string' || !ACTION_SET.has(row.action)) {
    return null;
  }
  const allowed = new Set(allowedShiftIds);
  const shiftId = typeof row.shiftId === 'string' && allowed.has(row.shiftId) ? row.shiftId : undefined;
  const reply = typeof row.reply === 'string' ? row.reply.trim().slice(0, 400) : undefined;
  return {
    action: row.action as GeminiShiftAction,
    ...(shiftId ? { shiftId } : {}),
    ...(reply ? { reply } : {}),
  };
}

function promptFor(context: GeminiShiftContext) {
  return [
    'You route Israeli shop WhatsApp to a shift desk.',
    'Return JSON only: {"action":"...","shiftId":"...","reply":"..."}',
    `action must be one of: ${GEMINI_SHIFT_ACTIONS.join(', ')}`,
    'shiftId must be one of the provided shift ids, or omitted.',
    'reply is short Hebrew (1-2 sentences). Do not invent people or shifts.',
    'Hello / thanks / unclear → clarify and say they can ask for משמרות, החלפה, or כיסוי.',
    'Asking what they work → show_roster.',
    'Cannot work / sick / want a replacement → start_cover if a shift is clear, else need_pick.',
    'Want to trade shifts → start_swap if a shift is clear, else need_pick.',
    'Cover or swap is fine → start_either.',
    'If waitingConfirm and they clearly accept the named coworker (מאשר, יוסי טוב) → accept_match.',
    'If waitingConfirm and they clearly refuse that coworker → decline_match.',
    'If waitingConfirm is leftover and they are sick / cannot arrive / need a replacement, start_cover. Do not accept_match.',
    'If only one shift is listed, set that shiftId.',
    'If a pending offer and they take it → accept_cover or accept_swap. If they refuse → decline_offer.',
    'If they cancel an open search → cancel_search.',
    'join/stop sandbox text → clarify with a short how-to, no roster change.',
    `Context: ${JSON.stringify(context)}`,
  ].join('\n');
}

export async function classifyShiftTextWithGemini(
  context: GeminiShiftContext,
): Promise<GeminiShiftDecision | null> {
  const apiKey = envValue('GEMINI_API_KEY');
  if (!apiKey) {
    return null;
  }
  const preferred = envValue('GEMINI_MODEL') || 'gemini-3.6-flash';
  const models = [...new Set([preferred, 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'])];
  const allowed = context.shifts.map((shift) => shift.id);
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: promptFor(context) }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });
  try {
    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body,
        },
      );
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: { status?: string; code?: number } };
        console.warn('gemini_classify_http', response.status, model, err.error?.status ?? err.error?.code ?? '');
        continue;
      }
      const json = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      const parsed = parseGeminiShiftDecision(text, allowed);
      if (parsed) {
        console.info('gemini_classify_ok', model, parsed.action);
        return parsed;
      }
    }
  } catch (error) {
    console.warn('gemini_classify_failed', error instanceof Error ? error.message : 'error');
  }
  return null;
}
