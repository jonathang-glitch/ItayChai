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
  signInTitle: 'העסק רץ בשיחה.',
  signInLede: 'הלקוח כותב. אתם רואים. מטפלים. בלי אפליקציה חדשה שהצוות צריך ללמוד.',
  continueAs: 'בחרו איך להיכנס',
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

export const PEOPLE = [
  {
    key: 'noa',
    email: 'owner-a@example.com',
    password: 'dev-password',
    name: 'נועה',
    role: 'בעלת העסק',
    place: 'חנות תל אביב',
    avatar: 'owner',
  },
  {
    key: 'ori',
    email: 'customer-a@example.com',
    password: 'dev-password',
    name: 'אורי',
    role: 'עובד',
    place: 'פונה לחנות',
    avatar: 'customer',
  },
  {
    key: 'dana',
    email: 'dana-a@example.com',
    password: 'dev-password',
    name: 'דנה',
    role: 'עובדת',
    place: 'פונה לחנות',
    avatar: 'customer',
  },
  {
    key: 'yossi',
    email: 'yossi-a@example.com',
    password: 'dev-password',
    name: 'יוסי',
    role: 'עובד',
    place: 'פונה לחנות',
    avatar: 'customer',
  },
  {
    key: 'roi',
    email: 'roi-a@example.com',
    password: 'dev-password',
    name: 'רועי',
    role: 'עובד',
    place: 'בלי משמרות קרובות',
    avatar: 'customer',
  },
  {
    key: 'shira',
    email: 'shira-a@example.com',
    password: 'dev-password',
    name: 'שירה',
    role: 'עובדת',
    place: 'עובדת שבת בערב',
    avatar: 'customer',
  },
] as const;

export const ACCOUNTS = {
  owner: { email: 'owner-a@example.com', password: 'dev-password' },
  customer: { email: 'customer-a@example.com', password: 'dev-password' },
} as const;

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
