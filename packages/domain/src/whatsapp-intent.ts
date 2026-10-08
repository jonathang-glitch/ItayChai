import {
  jerusalemDayKey,
  jerusalemWeekKey,
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

type Talk = { label: string; startsAt?: string };

function asTalks(items: Array<string | Talk> | undefined): Talk[] {
  return (items ?? []).map((item) => (typeof item === 'string' ? { label: item } : item));
}

function dayStamp(date: Date) {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
}

function weekdayName(date: Date) {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' })
    .format(date)
    .replace(/^יום\s+/, '');
}

function jerusalemDay(date: Date, daysAhead: number) {
  const [year, month, day] = jerusalemDayKey(date).split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + daysAhead, 12));
}

function addKey(day: string, days: number) {
  return jerusalemDayKey(jerusalemDay(new Date(`${day}T12:00:00Z`), days));
}

function partOf(shift: Talk): 'בוקר' | 'ערב' | null {
  if (shift.startsAt) {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Jerusalem',
      }).format(new Date(shift.startsAt)),
    );
    return hour < 15 ? 'בוקר' : 'ערב';
  }
  const label = fold(shift.label);
  if (mentions(label, 'בוקר')) {
    return 'בוקר';
  }
  if (mentions(label, 'ערב')) {
    return 'ערב';
  }
  return null;
}

function onDay(shift: Talk, dayName: string, stamp?: string) {
  if (shift.startsAt) {
    const start = new Date(shift.startsAt);
    return stamp ? dayStamp(start) === stamp : weekdayName(start) === dayName;
  }
  return stamp ? shift.label.includes(stamp) : mentions(fold(shift.label), dayName);
}

function inWeek(shift: Talk, sunday: string) {
  if (!shift.startsAt) {
    return false;
  }
  const day = jerusalemDayKey(shift.startsAt);
  return day >= sunday && day < addKey(sunday, 7);
}

function selectShifts(folded: string, shifts: Talk[], now: Date) {
  const today = mentions(folded, 'היום');
  const tomorrow = !today && mentions(folded, 'מחר');
  const nextWeek = /שבוע\s+הבא/u.test(folded);
  const thisWeek = !nextWeek && mentions(folded, 'השבוע');
  const named = WEEKDAYS.find((name) => mentions(folded, name));
  if (!today && !tomorrow && !nextWeek && !thisWeek && !named) {
    return null;
  }
  if (!/משמר|יש לי|מתי|עובד|עושה|מה/u.test(folded)) {
    return null;
  }
  let chosen = shifts;
  let when = '';
  if (today || tomorrow) {
    const date = today ? now : jerusalemDay(now, 1);
    chosen = chosen.filter((shift) => onDay(shift, weekdayName(date), dayStamp(date)));
    when = today ? 'היום' : 'מחר';
  } else if (nextWeek || thisWeek) {
    chosen = chosen.filter((shift) =>
      inWeek(shift, jerusalemWeekKey(nextWeek ? jerusalemDay(now, 7) : now)),
    );
    when = nextWeek ? 'בשבוע הבא' : 'השבוע';
  }
  if (named && !today && !tomorrow) {
    chosen = chosen.filter((shift) => onDay(shift, named));
    when = when ? `${when} ${named}` : named;
  }
  const morning = mentions(folded, 'בוקר');
  const evening = mentions(folded, 'ערב');
  if (morning && !evening) {
    chosen = chosen.filter((shift) => partOf(shift) === 'בוקר');
  }
  if (evening && !morning) {
    chosen = chosen.filter((shift) => partOf(shift) === 'ערב');
  }
  const partAsked = morning && !evening ? 'בוקר' : evening && !morning ? 'ערב' : '';
  return { chosen, when, today, tomorrow, week: nextWeek || thisWeek, partAsked };
}

function sayShifts(picked: NonNullable<ReturnType<typeof selectShifts>>, name: string | null) {
  const { chosen, when, today, tomorrow, week, partAsked } = picked;
  const yours = name ? `ל${name}` : 'לך';
  if (!chosen.length) {
    if (today || tomorrow || week) {
      return `${today || tomorrow ? 'לא. ' : ''}${when} אין ${yours} משמרת${partAsked ? ` ${partAsked}` : week ? 'ות' : ''}.`;
    }
    return `לא. אין ${yours} משמרת ב${when}${partAsked ? ` ב${partAsked}` : ''}.`;
  }
  const lines = chosen.map((shift) => shift.label);
  if (today || tomorrow) {
    if (lines.length === 1) {
      const part = partOf(chosen[0] ?? { label: '' });
      return part
        ? `${when} יש ${yours} משמרת ${part}: ${lines[0]}`
        : `${when} יש ${yours} משמרת: ${lines[0]}`;
    }
    return `${when} יש ${yours}:\n${lines.join('\n')}`;
  }
  if (week) {
    if (lines.length === 1) {
      const part = partOf(chosen[0] ?? { label: '' });
      return part
        ? `${when} יש ${yours} משמרת ${part}: ${lines[0]}`
        : `${when} יש ${yours} משמרת: ${lines[0]}`;
    }
    return `${when} יש ${yours}:\n${lines.join('\n')}`;
  }
  if (lines.length === 1) {
    return `כן. ${lines[0]}`;
  }
  return `כן. ב${when}:\n${lines.join('\n')}`;
}

export function answerDeskQuestion(
  text: string,
  facts: {
    pending?: { name: string; label: string; allowCover: boolean; allowSwap: boolean } | null;
    mine?: Array<string | Talk>;
    team?: { name: string; shifts: Array<string | Talk> }[];
    search?: { kind: string; label: string; status: string } | null;
  },
  now = new Date(),
) {
  const folded = fold(text);
  const person = (facts.team ?? []).find((row) => row.name && folded.includes(fold(row.name)));
  const subject = person ? asTalks(person.shifts) : asTalks(facts.mine);
  const picked = selectShifts(folded, subject, now);
  if (picked) {
    return sayShifts(picked, person?.name ?? null);
  }
  if (person && /משמר|מתי/u.test(folded)) {
    return subject.length
      ? `המשמרות של ${person.name}:\n${subject.map((shift) => shift.label).join('\n')}`
      : `אין ל${person.name} משמרות קרובות.`;
  }
  if (/המשמרות שלי|מה המשמרות שלי|איזה משמרות יש לי|מה יש לי/u.test(folded)) {
    const mine = asTalks(facts.mine);
    return mine.length
      ? `המשמרות שלך:\n${mine.map((shift) => shift.label).join('\n')}`
      : 'אין לך משמרות קרובות.';
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
  if (/משמר/u.test(folded)) {
    return 'אפשר לשאול על היום, על מחר, על יום בשבוע, או על השבוע הבא.';
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
