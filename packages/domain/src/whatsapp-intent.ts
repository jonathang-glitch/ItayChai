import {
  SHIFT_MATCH_ACTIONS,
  SHIFT_OFFER_ACTIONS,
  type ShiftMatchAction,
  type ShiftOfferAction,
} from '@itay-chai/contracts';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export type WhatsAppTextIntent =
  | 'yes'
  | 'no'
  | 'cover'
  | 'swap'
  | 'either'
  | 'accept'
  | 'decline_match'
  | 'cancel'
  | 'new'
  | 'unknown';

export type WhatsAppButtonIntent =
  | { kind: 'offer'; offerId: string; action: ShiftOfferAction; proposedShiftId?: string }
  | { kind: 'match'; sessionId: string; action: ShiftMatchAction }
  | { kind: 'cancel'; sessionId: string };

export function normalizeWhatsAppId(raw: string) {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith('+')) {
    return digits;
  }
  if (digits.startsWith('972')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length >= 9) {
    return `+972${digits.slice(1)}`;
  }
  return trimmed;
}

export function classifyWhatsAppText(raw?: string): WhatsAppTextIntent {
  const text = raw?.normalize('NFC').trim().replace(/[.!?]+$/u, '') ?? '';
  if (!text) {
    return 'unknown';
  }
  const folded = text.replace(/\s+/g, ' ').toLowerCase();
  if (/^(מאשרת? החלפה|מאשרת?|accept)$/u.test(folded)) {
    return 'accept';
  }
  if (/^(לא מאשרת?|דוחה|decline)$/u.test(folded)) {
    return 'decline_match';
  }
  if (/^(כיסוי \/ החלפה|כיסוי או החלפה|either)$/u.test(folded)) {
    return 'either';
  }
  if (/^(כיסוי|cover)$/u.test(folded)) {
    return 'cover';
  }
  if (/^(החלפה|swap)$/u.test(folded)) {
    return 'swap';
  }
  if (/^(כן|yes|y)$/u.test(folded)) {
    return 'yes';
  }
  if (/^(לא|no|n)$/u.test(folded)) {
    return 'no';
  }
  if (/^(בטל|ביטול|cancel)$/u.test(folded)) {
    return 'cancel';
  }
  if (/מחליף|החלפה|כיסוי/.test(text)) {
    return 'new';
  }
  return 'unknown';
}

export function inferRequestKind(intent: WhatsAppTextIntent): 'COVER' | 'SWAP' | 'EITHER' {
  if (intent === 'swap') {
    return 'SWAP';
  }
  if (intent === 'either') {
    return 'EITHER';
  }
  return 'COVER';
}

export function parseWhatsAppButton(buttonId?: string): WhatsAppButtonIntent | null {
  if (!buttonId) {
    return null;
  }
  const offer = buttonId.match(new RegExp(`^offer:(${UUID}):(${SHIFT_OFFER_ACTIONS.join('|')})(?::(${UUID}))?$`, 'i'));
  if (offer?.[1] && offer[2] && (SHIFT_OFFER_ACTIONS as readonly string[]).includes(offer[2])) {
    return {
      kind: 'offer',
      offerId: offer[1],
      action: offer[2] as ShiftOfferAction,
      ...(offer[3] ? { proposedShiftId: offer[3] } : {}),
    };
  }
  const match = buttonId.match(new RegExp(`^match:(${UUID}):(${SHIFT_MATCH_ACTIONS.join('|')})$`, 'i'));
  if (match?.[1] && match[2] && (SHIFT_MATCH_ACTIONS as readonly string[]).includes(match[2])) {
    return { kind: 'match', sessionId: match[1], action: match[2] as ShiftMatchAction };
  }
  const cancel = buttonId.match(new RegExp(`^search:(${UUID}):cancel$`, 'i'));
  if (cancel?.[1]) {
    return { kind: 'cancel', sessionId: cancel[1] };
  }
  return null;
}
