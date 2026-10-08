import {
  jerusalemDayKey,
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
  if (/לכסות|כיסוי|יכסה|אכסה|תכסה|לוקחת? את המשמרת|אני אקח|(^|\s)cover(\s|$)/u.test(folded)) {
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
  if (
    /(^|\s)(כן|בטח|אשמח|סבבה|יאללה|ברור|כמובן|בשמחה)(\s|$)/u.test(folded) &&
    !/^(לא|no)(?:\s|$)/u.test(folded)
  ) {
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
  const cover = /לכסות|כיסוי|יכסה|אכסה|תכסה/.test(folded);
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
    new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Jerusalem',
    }).format(startsAt),
  );
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jerusalem',
    }).format(startsAt),
  );
  const day = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(startsAt);
  const month = new Intl.DateTimeFormat('en-GB', {
    month: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(startsAt);
  const part = hour < 15 ? 'בוקר' : 'ערב';
  const numeric = `${day}/${month}`;
  return { id: shift.id, label, weekday, dateShort, part, numeric, startsAt };
}

export function matchShiftFromText(
  raw: string | undefined,
  shifts: ShiftChoice[],
): string | undefined {
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
  const weekdays = pool.filter(
    (shift) => shift.weekday.length >= 2 && mentions(text, shift.weekday),
  );
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
  if (text.includes('מחר')) {
    const tomorrow = tomorrowKey();
    const hits = pool.filter((shift) => jerusalemDayKey(shift.startsAt) === tomorrow);
    const part = mentions(text, 'בוקר') ? 'בוקר' : mentions(text, 'ערב') ? 'ערב' : '';
    const narrowed = part ? hits.filter((shift) => shift.part === part) : hits;
    if (narrowed.length === 1) {
      return narrowed[0]?.id;
    }
  }
  return undefined;
}

function tomorrowKey(now = new Date()) {
  const [year, month, day] = jerusalemDayKey(now).split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
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

export function isDeskQuestion(raw?: string) {
  const folded = fold(raw);
  if (!folded) {
    return false;
  }
  if (classifyWhatsAppText(raw) === 'hello' && !/[?？]/.test(raw ?? '')) {
    return false;
  }
  if (/[?？]/.test(raw ?? '')) {
    return true;
  }
  return /^(למה|מה|מי|איזה|איך|האם|כמה)\b/u.test(folded);
}

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

function answerAboutNamedDay(folded: string, mine: string[]) {
  const day = WEEKDAYS.find((name) => mentions(folded, name));
  if (!day || !/משמר|יש לי|מתי|עובד/.test(folded)) {
    return null;
  }
  const morning = mentions(folded, 'בוקר');
  const evening = mentions(folded, 'ערב');
  let matches = mine.filter((label) => mentions(fold(label), day));
  if (morning && !evening) {
    matches = matches.filter((label) => mentions(fold(label), 'בוקר'));
  }
  if (evening && !morning) {
    matches = matches.filter((label) => mentions(fold(label), 'ערב'));
  }
  const when = `${day}${morning && !evening ? ' בבוקר' : evening && !morning ? ' בערב' : ''}`;
  if (!matches.length) {
    return `לא. אין לך משמרת ב${when}.`;
  }
  if (matches.length === 1) {
    return `כן. ${matches[0]}`;
  }
  return `כן.\n${matches.join('\n')}`;
}

export function answerDeskQuestion(
  text: string,
  facts: {
    pending?: { name: string; label: string; allowCover: boolean; allowSwap: boolean } | null;
    mine?: string[];
    team?: { name: string; shifts: string[] }[];
    search?: { kind: string; label: string; status: string } | null;
  },
) {
  const folded = fold(text);
  const person = (facts.team ?? []).find((row) => row.name && folded.includes(fold(row.name)));
  if (person && /משמר|מתי/.test(folded)) {
    return person.shifts.length
      ? `המשמרות של ${person.name}:\n${person.shifts.join('\n')}`
      : `אין ל${person.name} משמרות קרובות.`;
  }
  const dayAnswer = answerAboutNamedDay(folded, facts.mine ?? []);
  if (dayAnswer) {
    return dayAnswer;
  }
  if (/המשמרות שלי|מה המשמרות שלי|איזה משמרות יש לי|מה יש לי/.test(folded)) {
    return facts.mine?.length ? `המשמרות שלך:\n${facts.mine.join('\n')}` : 'אין לך משמרות קרובות.';
  }
  if (facts.pending) {
    const { name, label, allowCover, allowSwap } = facts.pending;
    if (allowCover && allowSwap) {
      return `${name} ביקש כיסוי או החלפה ל${label}.`;
    }
    if (allowCover) {
      return `${name} ביקש כיסוי ל${label}. לא החלפה.`;
    }
    return `${name} ביקש החלפה ל${label}. לא כיסוי.`;
  }
  if (facts.search) {
    const kind =
      facts.search.kind === 'COVER'
        ? 'כיסוי'
        : facts.search.kind === 'SWAP'
          ? 'החלפה'
          : 'כיסוי או החלפה';
    if (facts.search.status === 'UNFILLED') {
      return `לא נמצא ${kind} ל${facts.search.label}.`;
    }
    return `פתוח עכשיו: ${kind} ל${facts.search.label}.`;
  }
  if (facts.mine?.length) {
    return `המשמרות שלך:\n${facts.mine.join('\n')}`;
  }
  return 'אין בקשה פתוחה כרגע.';
}

export function parseWhatsAppButton(buttonId?: string): WhatsAppButtonIntent | null {
  if (!buttonId) {
    return null;
  }
  const offer = buttonId.match(
    new RegExp(`^offer:(${UUID}):(${SHIFT_OFFER_ACTIONS.join('|')})(?::(${UUID}))?$`, 'i'),
  );
  if (offer?.[1] && offer[2] && (SHIFT_OFFER_ACTIONS as readonly string[]).includes(offer[2])) {
    return {
      kind: 'offer',
      offerId: offer[1],
      action: offer[2] as ShiftOfferAction,
      ...(offer[3] ? { proposedShiftId: offer[3] } : {}),
    };
  }
  const match = buttonId.match(
    new RegExp(`^match:(${UUID}):(${SHIFT_MATCH_ACTIONS.join('|')})$`, 'i'),
  );
  if (match?.[1] && match[2] && (SHIFT_MATCH_ACTIONS as readonly string[]).includes(match[2])) {
    return { kind: 'match', sessionId: match[1], action: match[2] as ShiftMatchAction };
  }
  const cancel = buttonId.match(new RegExp(`^search:(${UUID}):cancel$`, 'i'));
  if (cancel?.[1]) {
    return { kind: 'cancel', sessionId: cancel[1] };
  }
  return null;
}
