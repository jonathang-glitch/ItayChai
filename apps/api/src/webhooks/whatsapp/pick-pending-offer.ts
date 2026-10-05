import { shiftTalkWithDate } from '@itay-chai/database';
import type { WhatsAppTextIntent } from '@itay-chai/domain';

type OfferShift = {
  label: string;
  startsAt: Date | string;
};

export type NamedOffer = {
  requesterName: string;
  requestedShift: OfferShift | null;
};

const OFFER_REPLIES = new Set<WhatsAppTextIntent>(['yes', 'no', 'cover', 'swap', 'either', 'accept', 'decline_match']);

function when(shift: OfferShift) {
  return shiftTalkWithDate(new Date(shift.startsAt));
}

function offerMatches(text: string, offer: NamedOffer) {
  const folded = text.normalize('NFC');
  if (offer.requesterName && folded.includes(offer.requesterName)) {
    return true;
  }
  if (!offer.requestedShift) {
    return false;
  }
  return folded.includes(offer.requestedShift.label) || folded.includes(when(offer.requestedShift));
}

function whichOffer(offers: NamedOffer[]) {
  const lines = offers.map((offer) => {
    const label = offer.requestedShift ? when(offer.requestedShift) : '';
    return `${offer.requesterName}${label ? ` — ${label}` : ''}`;
  });
  return `יש כמה פניות. כתבו את השם:\n${lines.join('\n')}`;
}

export function choosePendingOffer<T extends NamedOffer>(offers: T[], text: string, intent: WhatsAppTextIntent) {
  if (offers.length === 0) {
    return {};
  }
  if (offers.length === 1) {
    return { offer: offers[0] };
  }
  const matches = offers.filter((offer) => offerMatches(text, offer));
  if (matches.length === 1) {
    return { offer: matches[0] };
  }
  if (matches.length > 1 || OFFER_REPLIES.has(intent)) {
    return { ask: whichOffer(offers) };
  }
  return {};
}
