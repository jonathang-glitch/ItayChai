import { phraseShiftTalk, shiftTalkWithDate } from './format';
import type { IncomingOffer } from './types';

const FEMININE_NAMES = new Set(['דנה', 'נועה', 'שירה', 'מיכל']);

export function isFeminineName(name: string) {
  const first = name.normalize('NFC').trim().split(/\s+/)[0] ?? '';
  return FEMININE_NAMES.has(first);
}

export function offerPrompt(offer: IncomingOffer) {
  const name = offer.requesterName;
  const wanted = offer.requestedShift ? shiftTalkWithDate(offer.requestedShift.startsAt) : '';
  const needs = isFeminineName(name) ? 'צריכה' : 'צריך';
  if (offer.allowCover && offer.allowSwap) {
    return `${name} ${needs} מחליף ב${wanted}. אפשר לכסות או להחליף.\nהאם אפשרי עבורך?`;
  }
  if (offer.allowSwap) {
    return `${name} רוצה להחליף את ${wanted}.\nהאם אפשרי עבורך?`;
  }
  return `${name} ${needs} מחליף ב${wanted}.\nהאם אפשרי עבורך?`;
}

export const COPY = {
  brand: 'איתי חי',
  signInKicker: 'לעסקים מקומיים',
  signInTitle: 'העסק נכנס לכאן.',
  signInLede: 'מנהלים את המשמרות, והצוות מדבר עם הסוכן בוואטסאפ.',
  emailEntry: 'כניסה',
  openShop: 'רישום',
  signUpHint: 'רושמים את העסק. הצוות לא נכנס לאתר.',
  phoneNumber: 'מספר',
  email: 'אימייל',
  password: 'סיסמה',
  shopName: 'שם העסק',
  signupOwnerName: 'השם שלך',
  whatsapp: 'וואטסאפ',
  signInSubmit: 'כניסה',
  signUpSubmit: 'רישום',
  emailTaken: 'האימייל הזה כבר רשום.',
  roster: 'משמרות',
  registration: 'הרשמה',
  registrationTitle: 'הרשמה',
  registrationLede: 'רק העסק נכנס לאתר. הצוות נרשם כאן בשם ובמספר וואטסאפ, ומשם מדבר עם הסוכן.',
  desk: 'פניות',
  ownerUpdates: 'עדכונים אליך',
  changePhone: 'שינוי מספר',
  registeredWorkers: 'רשומים',
  workerName: 'שם',
  saveWorker: 'רישום',
  workerSaved: 'נרשם. ההודעות יגיעו לוואטסאפ הזה.',
  editWorker: 'עריכה',
  cancelEdit: 'ביטול',
  workerUpdated: 'הפרטים נשמרו.',
  saveChanges: 'שומרים',
  removeAsk: 'להסיר?',
  confirmRemove: 'מסירים',
  badPhone: 'המספר צריך להיות ישראלי, למשל 052-123-4567.',
  registerFirst: 'קודם רושמים אדם בלשונית הרשמה.',
  savePhone: 'שומרים',
  phoneSaved: 'המספר נשמר. עדכונים יישלחו אליך.',
  addShift: 'משמרת חדשה',
  shiftWorker: 'עובד',
  shiftDate: 'תאריך',
  shiftStart: 'התחלה',
  shiftEnd: 'סיום',
  saveShift: 'שומרים משמרת',
  noWorkers: 'אין אנשים רשומים. מוסיפים שם ומספר, והסוכן מדבר איתם בוואטסאפ.',
  noRosterShifts: 'אין משמרות קרובות.',
  remove: 'מחיקה',
  openSearch: 'יש חיפוש פתוח. סוגרים אותו ואז מוחקים.',
  sameDay: 'לעובד הזה כבר יש משמרת באותו יום.',
  phoneUsed: 'המספר הזה כבר רשום.',
  ownerName: 'נועה',
  ownerRole: 'בעלת העסק',
  ownerPlace: 'חנות תל אביב',
  customerName: 'אורי',
  customerRole: 'עובד',
  customerPlace: 'פונה לחנות',
  entering: 'נכנסים…',
  badLogin: 'הכניסה לא הצליחה. בדקו את הפרטים ונסו שוב.',
  down: 'השירות לא זמין כרגע. נסו שוב בעוד רגע.',
  alreadyOpen: 'כבר מחפשים למשמרת הזאת.',
  sessionExpired: 'הכניסה פגה. היכנסו שוב.',
  notOnRoster: 'המשמרת הזאת כבר לא אצלך.',
  signOut: 'יציאה',
  open: 'פתוחות',
  done: 'טופלו',
  all: 'הכל',
  ownerEmpty: 'אין פניות ממתינות.',
  loadingDesk: 'טוענים פניות…',
  markDone: 'סמן כטופל',
  marked: 'סומן כטופל',
  saving: 'שומרים…',
  customerHello: 'בחרו משמרת, ואז כיסוי, החלפה, או כיסוי / החלפה.',
  send: 'שלח בקשה',
  sending: 'שולחים…',
  waiting: 'הבקשה בטיפול.',
  lastFromStore: 'תשובה מהחנות',
  lastFromCustomer: 'הודעת לקוח',
  pickShift: 'בחרו משמרת',
  newRequest: 'בקשה חדשה',
  pickIntent: 'מה צריך?',
  coverIntent: 'כיסוי',
  swapIntent: 'החלפה',
  eitherIntent: 'כיסוי / החלפה',
  pickSwapShift: 'איזו משמרת להחליף?',
  yourWeek: 'המשמרות שלך בשבוע הזה:',
  noWeekShifts: 'אין לך משמרות בשבוע הזה.',
  swapRelevantHint: 'רק ימים שהמבקש פנוי — מסומנים בירוק.',
  relevantDay: 'פנוי',
  back: 'חזרה',
  incomingOffers: 'פניות מהצוות',
  acceptCover: 'כיסוי',
  acceptSwap: 'החלפה',
  acceptYes: 'כן',
  declineOffer: 'דחייה',
  offerQueued: 'קיבלנו. נעדכן אם יהיה צורך.',
  swapWaiting: 'שאלנו את המבקש. נעדכן.',
  swapDone: 'הוחלף.',
  offerCancelled: 'כבר לא צריך — נמצא פתרון.',
  offerAccepted: 'תודה. זה נשמר.',
  offerDeclined: 'סימנו שלא.',
  confirmMatch: 'מאשר החלפה',
  refuseMatch: 'לא מתאים',
  cancelSearch: 'בטל חיפוש',
  noShifts: 'אין משמרות ברשימה.',
  loadingShifts: 'טוענים משמרות…',
  shiftFor: 'משמרת',
  approve: 'אשר',
  reject: 'דחה',
  needCover: 'צריך מחליף',
  decided: 'ההחלטה נשמרה',
};

const STATUS: Record<string, string> = {
  DRAFT: 'חדשה',
  INITIALIZING: 'בטיפול',
  PLANNING: 'בטיפול',
  COMPLETED: 'טופלה',
  FAILED: 'דורשת תשומת לב',
  OPEN: 'ממתינה',
  SEEKING: 'מחפשים',
  MATCH_PROPOSED: 'ממתין לאישור',
  COMMITTED: 'בוצע',
  UNFILLED: 'לא נמצא',
  CANCELLED: 'בוטל',
  APPROVED: 'אושרה',
  REJECTED: 'נדחתה',
  NEEDS_REPLACEMENT: 'צריך מחליף',
  PENDING: 'ממתינה',
  ACCEPTED: 'אושרה',
  DECLINED: 'נדחתה',
  QUEUED: 'בתור',
};

export function statusLabel(status: string) {
  return STATUS[status] ?? status;
}

function apiMessage(body: unknown) {
  if (!body || typeof body !== 'object' || !('message' in body)) {
    return '';
  }
  const message = (body as { message: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }
  if (message && typeof message === 'object') {
    return 'Check the hours and open days';
  }
  return '';
}

export function rosterFailure(body: unknown) {
  const message = apiMessage(body);
  if (message === 'Email already registered') {
    return COPY.emailTaken;
  }
  if (message === 'Phone already used') {
    return COPY.phoneUsed;
  }
  if (message === 'Enter a phone number with country code') {
    return COPY.badPhone;
  }
  if (message === 'Worker has an open search' || message === 'Shift is in an open search') {
    return COPY.openSearch;
  }
  if (message === 'Shift already exists that day') {
    return COPY.sameDay;
  }
  if (message === 'Close must be after open' || message === 'Check the hours and open days') {
    return 'שעת הסגירה צריכה להיות אחרי הפתיחה, וחייב להיות יום פתוח.';
  }
  if (/[\u0590-\u05FF]/.test(message)) {
    return message;
  }
  return COPY.down;
}

export function storeLabel(name: string | null | undefined) {
  return name || COPY.ownerPlace;
}

export function personName(name: string | null | undefined, roleName: string) {
  return name || (roleName === 'owner' ? COPY.ownerName : COPY.customerName);
}

const REPLIES: Record<string, string> = {
  'Your request was received.': 'הבקשה נקלטה.',
};

export function displayBody(body: string) {
  return phraseShiftTalk(REPLIES[body] ?? body);
}
