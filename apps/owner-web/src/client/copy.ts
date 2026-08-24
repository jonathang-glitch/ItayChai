import { phraseShiftTalk } from './format';

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
  signOut: 'יציאה',
  open: 'פתוחות',
  done: 'טופלו',
  all: 'הכל',
  ownerEmpty: 'אין פניות ממתינות.',
  loadingDesk: 'טוענים פניות…',
  markDone: 'סמן כטופל',
  marked: 'סומן כטופל',
  saving: 'שומרים…',
  customerHello: 'לחצו על המשמרת שצריך להחליף. זה נשלח לנועה.',
  send: 'שלח בקשה',
  sending: 'שולחים…',
  waiting: 'הבקשה אצל נועה.',
  lastFromStore: 'תשובה מהחנות',
  lastFromCustomer: 'הודעת לקוח',
  pickShift: 'בחרו משמרת להחלפה',
  noShifts: 'אין משמרות ברשימה.',
  loadingShifts: 'טוענים משמרות…',
  shiftFor: 'משמרת',
  approve: 'אשר',
  reject: 'דחה',
  needCover: 'צריך מחליף',
  decided: 'ההחלטה נשמרה',
};

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
  APPROVED: 'אושרה',
  REJECTED: 'נדחתה',
  NEEDS_REPLACEMENT: 'צריך מחליף',
};

export function statusLabel(status: string) {
  return STATUS[status] ?? status;
}

export function storeLabel(name: string | null | undefined) {
  return name || COPY.ownerPlace;
}

export function personName(name: string | null | undefined, roleName: string) {
  return name || (roleName === 'customer' ? COPY.customerName : COPY.ownerName);
}

const REPLIES: Record<string, string> = {
  'Your request was received.': 'הבקשה נקלטה.',
};

export function displayBody(body: string) {
  return phraseShiftTalk(REPLIES[body] ?? body);
}
