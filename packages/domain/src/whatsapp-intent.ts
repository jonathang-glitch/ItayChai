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
  | 'roster'
  | 'hello'
  | 'help'
  | 'unknown';

export type WhatsAppButtonIntent =
  | { kind: 'offer'; offerId: string; action: ShiftOfferAction; proposedShiftId?: string }
  | { kind: 'match'; sessionId: string; action: ShiftMatchAction }
  | { kind: 'cancel'; sessionId: string };

export type ShiftChoice = {
  id: string;
  label: string;
  startsAt: Date | string;
};

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

function fold(raw?: string) {
  return (raw ?? '')
    .normalize('NFC')
    .trim()
    .replace(/[.!?־,;:]+$/gu, '')
    .replace(/[׳']/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/להחליך|לחליך|להחלף/gu, 'להחליף')
    .replace(/חליך/gu, 'חליף');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentions(text: string, phrase: string) {
  if (!phrase) {
    return false;
  }
  return new RegExp(`(?<!\\p{L})(?:[בלמהושכ])?${escapeRegExp(phrase)}(?!\\p{L})`, 'u').test(text);
}

export function classifyWhatsAppText(raw?: string): WhatsAppTextIntent {
  const folded = fold(raw);
  if (!folded) {
    return 'unknown';
  }
  if (/(לא אכפת|כיסוי\s*\/\s*החלפה|כיסוי או החלפה|either)/u.test(folded)) {
    return 'either';
  }
  if (/(לא מאשרת?|לא מאשרים|דוחה את ההחלפה|דוחה|מסרבת?|מסרב|פחות מתאים)/u.test(folded)) {
    return 'decline_match';
  }
  if (/(מאשרת?(\s+את)?(\s+ההחלפה)?|(^|\s)accept(\s|$))/u.test(folded)) {
    return 'accept';
  }
  if (/(^|\s)(בטל|ביטול|תבטל|cancel)(\s|$)/u.test(folded)) {
    return 'cancel';
  }
  if (/(לא בטוח|לא בטוחה|לא יודע|לא יודעת|לא ברור)/u.test(folded)) {
    return 'unknown';
  }
  if (/(לא יכולה? להגיע|לא אוכל להגיע|לא אגיע|לא מגיע למשמרת)/u.test(folded)) {
    return 'new';
  }
  if (/לכסות|כיסוי|אני אכסה|אכסה|לוקחת? את המשמרת|אני אקח|(^|\s)cover(\s|$)/u.test(folded)) {
    return 'cover';
  }
  if (
    (/^(לא|no)(?:\s|$)/u.test(folded) ||
      /(לא רוצה|לא תודה|תודה לא|אין לי|לא יכולה|לא יכול|לא מעוניינ|לא מתאים|לא מעניין|לא הפעם|לא כרגע|לא אפשרי|אי אפשר|אין אפשרות|אין סיכוי|עדיף שלא|נראה לי שלא|קשה לי|עסוקה|עסוק|מוותרת?|חוזרת בי|סליחה|לא ממש|לא נוח|nope|cannot|can'?t|(^|\s)no(\s|$))/u.test(
        folded,
      )) &&
    !/מאשר/.test(folded)
  ) {
    return 'no';
  }
  if (/(החלפה|להחליף|נחליף|מחליפים|(^|\s)swap(\s|$))/u.test(folded)) {
    return 'swap';
  }
  if (
    /^(כן|בטח|אשמח|בסדר|סבבה|יאללה|ברור|כמובן|בשמחה|אין בעיה|אוקיי|אוקי|טוב|יכולה|יכול|sure|ok|okay|yes|y)$/u.test(
      folded,
    )
  ) {
    return 'yes';
  }
  if (/(^|\s)(כן|בטח|אשמח|סבבה|יאללה|ברור|כמובן|בשמחה)(\s|$)/u.test(folded) && !/^(לא|no)(?:\s|$)/u.test(folded)) {
    return 'yes';
  }
  if (
    /צריך מחליף|רוצה מחליף|צריכה מחליף|יחליף אותי|יקח במקומי|במקומי|מישהו יחליף|מישהו יקח|שתחליף אותי/.test(
      folded,
    )
  ) {
    return 'new';
  }
  if (
    (/^(משמרות|המשמרות)$/u.test(folded) ||
      /(מה המשמרות|המשמרות שלי|איזה משמרות|מה יש לי)/u.test(folded)) &&
    !/(יחליף|יקח|במקומי|להחליף|החלפה|כיסוי|מחליף)/u.test(folded)
  ) {
    return 'roster';
  }
  if (/(משהו אחר|מה עוד|מה אפשר|איך אפשר|אפשרויות|מה אפשר לעשות)/u.test(folded)) {
    return 'help';
  }
  if (
    /^(שלום|שלומות|היי|הי|אהלן|בוקר טוב|ערב טוב|מה נשמע|נשמע מה|מה קורה|מה המצב|היו|hi|hello|hey)(?:\s|$)/u.test(
      folded,
    )
  ) {
    return 'hello';
  }
  return 'unknown';
}

export function requestedArrangement(raw?: string): 'cover' | 'swap' | null {
  const folded = fold(raw);
  if (!folded || /^(למה|מה|מי|איזה|איך)\b/u.test(folded)) {
    return null;
  }
  const cover = /לכסות|כיסוי/.test(folded);
  const swap = /החלפה|להחליף|נחליף/.test(folded);
  const refusesSwap = /לא (?:יכול|יכולה|רוצה) להחליף|בלי החלפה/.test(folded);
  if (cover && (!swap || refusesSwap)) {
    return 'cover';
  }
  if (swap && !cover && !refusesSwap) {
    return 'swap';
  }
  return null;
}

export function isSandboxJoin(raw?: string) {
  return /^(join|stop)\b/iu.test(fold(raw));
}

export function isShortReply(raw?: string) {
  const folded = fold(raw);
  return folded.length > 0 && folded.length <= 24 && folded.split(/\s+/).length <= 3;
}

export function shouldClassifyWithGemini(raw?: string, _intent = classifyWhatsAppText(raw)) {
  void _intent;
  if (isSandboxJoin(raw) || !fold(raw)) {
    return false;
  }
  return true;
}

export function classifyMatchReply(raw?: string): 'accept' | 'decline' | 'unknown' {
  const folded = fold(raw);
  if (!folded) {
    return 'unknown';
  }
  const wantsOther = /(מישהו אחר|משהו אחר|לא יוסי|בלי יוסי|מישהו שהוא לא)/u.test(folded);
  const likesPeer = /(יוסי.{0,16}טוב|טוב.{0,16}יוסי|רק יוסי|יוסי בסדר|יוסי הוא)/u.test(folded);
  if (likesPeer && /לא רוצה.{0,24}(משהו|מישהו) אחר/u.test(folded)) {
    return 'accept';
  }
  if (likesPeer && !wantsOther) {
    return 'accept';
  }
  if (wantsOther && !likesPeer) {
    return 'decline';
  }
  const intent = classifyWhatsAppText(raw);
  if (intent === 'accept' || intent === 'yes') {
    return 'accept';
  }
  if (intent === 'decline_match') {
    return 'decline';
  }
  if (intent === 'no' && isShortReply(raw)) {
    return 'decline';
  }
  return 'unknown';
}

function shiftTokens(shift: ShiftChoice) {
  const startsAt = typeof shift.startsAt === 'string' ? new Date(shift.startsAt) : shift.startsAt;
  const label = fold(shift.label);
  const weekday = fold(
    new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' })
      .format(startsAt)
      .replace(/^יום\s+/, ''),
  );
  const dateShort = fold(
    new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', timeZone: 'Asia/Jerusalem' }).format(startsAt),
  );
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }).format(startsAt),
  );
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Asia/Jerusalem' }).format(startsAt);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: 'Asia/Jerusalem' }).format(startsAt);
  const part = hour < 15 ? 'בוקר' : 'ערב';
  const numeric = `${day}/${month}`;
  return { id: shift.id, label, weekday, dateShort, part, numeric, startsAt };
}

export function matchShiftFromText(raw: string | undefined, shifts: ShiftChoice[]): string | undefined {
  const text = fold(raw);
  if (!text || !shifts.length) {
    return undefined;
  }
  const tokens = shifts.map(shiftTokens);
  const pool = tokens.filter((shift) => {
    const keys = [shift.label, shift.weekday, shift.dateShort].filter((key) => key.length >= 2);
    return !keys.some((key) => new RegExp(`לא\\s+${escapeRegExp(key)}`, 'u').test(text));
  });
  const scored = pool.filter((shift) => {
    if (mentions(text, shift.label) || mentions(text, shift.dateShort)) {
      return true;
    }
    if (new RegExp(`(^|\\D)${escapeRegExp(shift.numeric)}(\\D|$)`).test(text.replace(/\./g, '/'))) {
      return true;
    }
    if (!mentions(text, shift.weekday) || shift.weekday.length < 2) {
      return false;
    }
    const sameDay = pool.filter((row) => row.weekday === shift.weekday);
    return sameDay.length === 1 || mentions(text, shift.part);
  });
  if (scored.length === 1) {
    return scored[0]?.id;
  }
  const weekdays = pool.filter((shift) => shift.weekday.length >= 2 && mentions(text, shift.weekday));
  if (weekdays.length === 1) {
    return weekdays[0]?.id;
  }
  if (weekdays.length > 1) {
    const hasPart = mentions(text, 'בוקר') || mentions(text, 'ערב');
    const now = Date.now();
    const soonest = [...weekdays]
      .filter((shift) => !hasPart || mentions(text, shift.part))
      .sort((left, right) => {
        const leftFuture = left.startsAt.getTime() >= now ? 0 : 1;
        const rightFuture = right.startsAt.getTime() >= now ? 0 : 1;
        return leftFuture - rightFuture || left.startsAt.getTime() - right.startsAt.getTime();
      });
    return soonest[0]?.id;
  }
  return undefined;
}

export function inferRequestKind(intent: WhatsAppTextIntent): 'COVER' | 'SWAP' | 'EITHER' {
  if (intent === 'swap') {
    return 'SWAP';
  }
  if (intent === 'cover') {
    return 'COVER';
  }
  return 'EITHER';
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
