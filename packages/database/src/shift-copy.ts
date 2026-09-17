import { requestIntentText, shiftLabelFromStart, type ShiftRequestKind } from '@itay-chai/contracts';

const FEMININE_NAMES = new Set(['דנה', 'נועה', 'שירה', 'מיכל']);

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Jerusalem',
});

export function isFeminineName(name: string) {
  const first = name.normalize('NFC').trim().split(/\s+/)[0] ?? '';
  return FEMININE_NAMES.has(first);
}

export function shiftTalk(startsAt: Date) {
  return shiftLabelFromStart(startsAt);
}

export function shiftTalkWithDate(startsAt: Date) {
  return `${shiftLabelFromStart(startsAt)} (${dateFmt.format(startsAt)})`;
}

export function intentText(kind: ShiftRequestKind, label: string) {
  return requestIntentText(kind, label);
}

export function seekingMessage(kind: ShiftRequestKind, label: string) {
  if (kind === 'COVER') {
    return `מחפשים מחליף ל${label}. נעדכן.`;
  }
  if (kind === 'SWAP') {
    return `מחפשים מי שיחליף איתך את ${label}.`;
  }
  return `מחפשים פתרון ל${label} — כיסוי או החלפה.`;
}

export function coverAsk(requester: string, wanted: string) {
  const needs = isFeminineName(requester) ? 'צריכה' : 'צריך';
  return `${requester} ${needs} מחליף ב${wanted}.\nהאם אפשרי עבורך?`;
}

export function swapAsk(requester: string, wanted: string, choices: string[] = []) {
  if (!choices.length) {
    return `${requester} רוצה להחליף את ${wanted}.\nהאם אפשרי עבורך?`;
  }
  return [`${requester} רוצה להחליף את ${wanted}.`, 'איזו משמרת להחליף?', ...choices].join('\n');
}

export function eitherAsk(requester: string, wanted: string, choices: string[] = []) {
  const needs = isFeminineName(requester) ? 'צריכה' : 'צריך';
  if (choices.length) {
    return [`${requester} ${needs} מחליף ב${wanted}. אפשר לכסות, או להחליף.`, 'איזו משמרת להחליף?', ...choices].join('\n');
  }
  return `${requester} ${needs} מחליף ב${wanted}. אפשר לכסות או להחליף.\nהאם אפשרי עבורך?`;
}

export function offerAsk(kind: ShiftRequestKind, requester: string, wanted: string, choices: string[] = []) {
  if (kind === 'COVER') {
    return coverAsk(requester, wanted);
  }
  if (kind === 'SWAP') {
    return swapAsk(requester, wanted, choices);
  }
  return eitherAsk(requester, wanted, choices);
}

export function whatsAppReplyHint(kind: ShiftRequestKind) {
  if (kind === 'SWAP') {
    return 'כתבי את המשמרת שאת רוצה לתת, או לא.';
  }
  if (kind === 'EITHER') {
    return 'אפשר לכתוב כיסוי, את המשמרת שאת רוצה לתת, או לא.';
  }
  return 'אפשר לכתוב כן או לא.';
}

export function coverCommitted(winner: string, wanted: string, forWinner: boolean) {
  return forWinner ? `המשמרת אצלך: ${wanted}.` : `${winner} מכסה את ${wanted}. המשמרת ירדה ממך.`;
}

export function swapProposed(
  name: string,
  wantedAt: Date,
  offeredAt: Date | null,
  forRequester: boolean,
  requester = '',
) {
  const offered = offeredAt ? shiftTalkWithDate(offeredAt) : '';
  const wanted = shiftTalk(wantedAt);
  if (forRequester) {
    const ready = isFeminineName(name) ? 'מוכנה' : 'מוכן';
    const youDo = isFeminineName(requester) ? 'את תעשי' : 'אתה תעשה';
    const ask = isFeminineName(requester) ? 'האם מאשרת?' : 'האם מאשר?';
    return `${name} ${ready} להחליף. כך ש${youDo} ${offered}.\n${ask}`;
  }
  return `שאלנו את המבקש. ${wanted} תמורת ${offered}.`;
}

export function swapCommitted(wanted: string, offered: string) {
  return `הוחלף. ${offered} אצלך. ${wanted} אצל הצד השני.`;
}

export function swapDonePeer(requester: string, receivedAt: Date, givenAt: Date) {
  return `${requester} אישר את ההחלפה.\nקיבלת ${shiftTalkWithDate(receivedAt)}.\nנתת ${shiftTalkWithDate(givenAt)}.`;
}

export function noLongerNeeded() {
  return 'כבר לא צריך — נמצא פתרון.';
}

export function searchCancelled() {
  return 'החיפוש בוטל.';
}

export function requestCancelled() {
  return 'הבקשה בוטלה.';
}

export function alreadyTaken() {
  return 'כבר נתפס.';
}

export function gotIt() {
  return 'קיבלנו.';
}

export function queuedSwap() {
  return 'קיבלנו. אם ההצעה הקודמת לא תאושר, נפנה אליך.';
}

export function queuedCover() {
  return 'קיבלנו. אם ההחלפה לא תאושר, נעביר אליך את המשמרת.';
}

export function requesterRefused() {
  return 'המבקש לא אישר את ההחלפה.';
}

export function unfilled(label: string) {
  return `לא נמצא פתרון ל${label}.`;
}

export function howToStart() {
  return 'היי. אפשר לכתוב משמרות, החלפה, כיסוי, או צריך החלפה בחמישי בערב.';
}

export function whatElse() {
  return 'אפשר לנסות כיסוי במקום החלפה, או לבקש משמרת אחרת. כתבי כיסוי, החלפה, או משמרות.';
}

export function didNotUnderstand() {
  return 'לא הבנתי. אפשר לכתוב משמרות, החלפה, כיסוי, כן, לא, או את שם המשמרת.';
}

export function myShifts(labels: string[] = []) {
  if (!labels.length) {
    return 'אין לך משמרות קרובות.';
  }
  return ['המשמרות שלך:', ...labels].join('\n');
}

export function pickSwapAgain(choices: string[] = []) {
  if (!choices.length) {
    return 'איזו משמרת להחליף? כתבי את המשמרת, או לא.';
  }
  return ['איזו משמרת להחליף?', ...choices, 'כתבי את המשמרת שאת רוצה לתת, או לא.'].join('\n');
}

export function searchSummary(
  _kind: ShiftRequestKind,
  status: string,
  names: string[],
  match?: { name: string; offered: string } | null,
) {
  const sent = names.length ? `נשלח ל${names.join(', ')}` : 'אין מועמדים';
  if (status === 'MATCH_PROPOSED' && match) {
    return `ממתין לאישור · ${match.name} · ${match.offered}`;
  }
  if (status === 'COMMITTED' && match) {
    return match.offered ? `הוחלף עם ${match.name}` : `${match.name} מכסה`;
  }
  if (status === 'SEEKING') {
    return sent;
  }
  return sent;
}
