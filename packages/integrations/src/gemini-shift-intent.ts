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
  team?: { name: string; shifts: string[] }[];
  options?: {
    shiftId: string;
    label: string;
    who: { name: string; canCover: boolean; canSwap: boolean; swap: string[]; block: string | null }[];
  }[];
  searches?: { status: string; kind: string; shift: string }[];
  finish?: 'live_auto' | 'ask_coworker';
  pendingOffer?: { allowCover: boolean; allowSwap: boolean; swapShiftIds: string[] };
  waitingConfirm?: boolean;
  awaitingConfirmSwap?: boolean;
  awaitingAsk?: 'confirm_swap' | 'pick_cover' | 'pick_swap' | 'pick_either' | 'none';
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
    'reply is the Hebrew they will read, 1-3 short sentences. Use only Context. Never invent a person, a shift, or a reason.',
    'Any question, including one with ?, למה, מה, מי, איזה, איך, or האם, is clarify. Reply answers from pendingOffer, searches, team, and options. A question never starts a cover or a swap and never asks which shift to pick.',
    'options is who can take each of the speaker’s shifts. canCover false with busy_that_day means that person already works that day. canSwap false with no_swap_shift means they are free that day but have no shift the speaker can take: it must fall on a day the speaker is free, this week or next, and end after the speaker’s shift starts.',
    'finish ask_coworker: the coworker is asked and nothing is committed until he answers. A swap still commits only when the requester sends accept_match.',
    'Do not answer a question with a menu.',
    'Hello with no question → clarify and say they can ask for משמרות, החלפה, or כיסוי.',
    'team holds coworker shifts. shifts holds the speaker’s shifts. show_roster is only the speaker’s own list.',
    'show_roster only when they ask which of their own shifts they have and are not asking to change one.',
    'The word משמרות inside a request is not show_roster.',
    'Kinds: cover is cover only, swap is swap only, either is cover or swap.',
    'Explicit כיסוי or לכסות → start_cover. Explicit החלפה or להחליף → start_swap. כיסוי או החלפה, or either is fine → start_either.',
    'Cannot work / sick, with no cover or swap word → start_either if a shift is clear, else need_pick.',
    'awaitingAsk confirm_swap is the only time accept_match is allowed.',
    'awaitingAsk pick_cover: a shift name is start_cover. pick_swap: start_swap. pick_either: start_either.',
    'If they will not take the waiting swap and ask for cover only, action is start_cover. If they will take cover or a swap, action is start_either.',
    'If waitingConfirm and they clearly refuse that coworker and do not ask for another kind → decline_match.',
    'If waitingConfirm is leftover and they are sick / cannot arrive, start_either. Do not accept_match.',
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
      for (let attempt = 0; attempt < 2; attempt += 1) {
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
        if (response.status === 503 || response.status === 429) {
          console.warn('gemini_classify_http', response.status, model, 'retry');
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }
        if (!response.ok) {
          const err = (await response.json().catch(() => ({}))) as { error?: { status?: string; code?: number } };
          console.warn('gemini_classify_http', response.status, model, err.error?.status ?? err.error?.code ?? '');
          break;
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
        break;
      }
    }
  } catch (error) {
    console.warn('gemini_classify_failed', error instanceof Error ? error.message : 'error');
  }
  return null;
}
