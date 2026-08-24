export type PreviewLink = { label: string; href: string };

export type StepExplain = {
  did: string;
  saved: string;
  verify: string;
  links: PreviewLink[];
};

export const PREVIEW = {
  health: 'http://127.0.0.1:3000/health',
  look: 'http://127.0.0.1:5173/look.html',
  studio: 'http://127.0.0.1:5173/tables.html',
  editor: 'http://127.0.0.1:5173/tables.html',
  owner: 'http://127.0.0.1:5173/',
  ops: 'http://127.0.0.1:5174/',
};

const health: PreviewLink = { label: 'תשובת השרת עכשיו (JSON)', href: PREVIEW.health };
const editor: PreviewLink = { label: 'טבלאות ב-Docker על המק', href: PREVIEW.editor };
const studio: PreviewLink = { label: 'טבלאות Docker — רענון', href: PREVIEW.studio };
const look: PreviewLink = { label: 'דף כל הקישורים לבדיקה', href: PREVIEW.look };

export const EXPLAIN: Record<string, StepExplain> = {
  health: {
    did: 'הדפדףן קרא GET /health. השרת על המק (פורט 3000) הריץ SELECT 1 מול Postgres. אם המסד חי, חוזר {"ok":true,"database":"up"}. אין כאן הודעת וואטסאפ ואין כתיבה חדשה — רק דופק.',
    saved: 'לא נשמרה שורה חדשה. החיבור הוא ל-Docker, מכולת המסד, כתובת 127.0.0.1:54322, מסד postgres. הקובץ שמכוון לזה: /Users/jonathangad/ItayChai/.env (DATABASE_URL).',
    verify: 'פתחו את קישור JSON. חייבים לראות ok ו-database up. אם 503 או הדף לא נפתח — השרת או Docker כבויים. אחר כך פתחו את טבלאות Docker וודאו שיש tenants, users, agent_sessions.',
    links: [health, editor, studio],
  },
  login: {
    did: 'נשלחו שלוש כניסות אמיתיות: owner-a@example.com, owner-b@example.com, stakeholder-a@example.com, סיסמה dev-password. כל אחד קיבל access token ו-refresh token משלו. אלה שני עסקים ושחקן קריאה בלבד.',
    saved: 'במסד, בטבלה auth_sessions, נוספו שורות עם refresh token. המשתמשים עצמם כבר היו ב־users וב־tenant_memberships (נזרעו מקומית). עסק א׳ מחובר ל-tenant 00000000-…0001, עסק ב׳ ל-…0002.',
    verify: 'Docker → טבלת auth_sessions: שלוש שורות חדשות לפי הזמן. users: חפשו owner-a / owner-b. tenant_memberships: אותו user_id לא יושב על שני העסקים כבעלים.',
    links: [editor, health],
  },
  whatsapp: {
    did: 'נשלח POST /api/v1/webhooks/whatsapp/mock עם הטקסט «צריך החלפת משמרת». ה-API יצר משימה, כתב הודעה, שם עבודה ב-Redis. ה-worker על המק הריץ DRAFT → INITIALIZING → PLANNING → COMPLETED והחזיר «הבקשה נקלטה».',
    saved: 'Postgres ב-Docker על המק, טבלאות: agent_sessions (המשימה), messages (נכנס/יוצא), webhook_receipts, inbox_messages, session_transitions, domain_events, outbox_messages, audit_entries. התור הרגעי: Redis ב-Docker, פורט 6379.',
    verify: 'Docker → agent_sessions: סטטוס COMPLETED על המזהה שמופיע כאן. messages: שתי שורות לאותו session. outbox_messages: שורה עם published_at מלא. אם COMPLETED לא מגיע — העובד כבוי.',
    links: [editor, health],
  },
  duplicate: {
    did: 'אותו מזהה הודעה חיצוני נשלח שוב, כמו שוואטסאפ לפעמים שולח כפיל. השרת החזיר את אותו sessionId. לא נוצרה משימה שנייה.',
    saved: 'אין שורת agent_sessions חדשה. ההגנה יושבת ב-webhook_receipts / inbox_messages / idempotency_records לפי external_message_id.',
    verify: 'Docker → agent_sessions: ספרו כמה שורות עם אותו external_message_id. חייב להיות 1. אם 2 — הכפיל לא נחסם.',
    links: [editor],
  },
  'isolation-read': {
    did: 'עסק א׳ ביקש את רשימת המשימות של עצמו — קיבל 200 ואת המשימה. עסק א׳ ביקש את עסק ב׳ עם הכותרת x-tenant-id של ב׳ — נחסם 403. עסק ב׳ ביקש את משימות א׳ — נחסם 403. אין כאן «הסתרה במסך». השרת סירב.',
    saved: 'לא נכתב נתון חדש. הסירוב נשען על tenant_memberships: ל-owner-b אין חברות פעילה בעסק א׳. Postgres גם מפעיל RLS על תפקיד האפליקציה.',
    verify: 'Docker → tenant_memberships: owner-b רק על tenant …0002. נסו מהדפדפן אחרי «תיכנס כעסק ב׳»: השולחן הימני חייב להראות אין גישה, בלי לראות את משימת א׳.',
    links: [editor, { label: 'מסך ההוכחה — כניסה כעסק ב׳', href: PREVIEW.owner }],
  },
  'isolation-write': {
    did: 'עסק ב׳ ניסה לאשר (acknowledge) את משימת עסק א׳ — 403. ניסה את אותה משימה כאילו היא שלו — 404 (לא קיימת אצלו). בעל העניין של א׳ ניסה לכתוב — 403 (קריאה בלבד).',
    saved: 'לא עודכן agent_sessions. אין audit של הצלחה. המשימה נשארה כמו שהייתה אצל א׳.',
    verify: 'Docker → agent_sessions על המזהה של א׳: updated_at לא זז בגלל ב׳. אם מישהו מצפה ש«ב׳ יתקן את א׳» — זה בדיוק מה שנחסם.',
    links: [editor],
  },
  ops: {
    did: 'בעל עסק א׳ ביקש break-glass (גישת חירום של צוות) — 403. משתמש ops נכנס, ואז ביקש גישה עם סיבה קצרה מדי («short») — 400. חירום פנימי דורש MFA וסיבה של לפחות 8 תווים.',
    saved: 'לא נוצרה שורה ב-break_glass_grants. הסירוב הוא הצלחה: אין מעקף שקט.',
    verify: 'Docker → break_glass_grants: אין grant חדש מהלחיצה הזו. ops-web: http://127.0.0.1:5174 רק מעטפת סטטוס, לא דלת אחורית.',
    links: [editor, { label: 'קונסולת תפעול', href: PREVIEW.ops }],
  },
  event: {
    did: 'נקרא GET /api/v1/sessions/:id/trace על המשימה שהושלמה. השרת החזיר אירוע דומיין אחד, שורת outbox אחת שפורסמה, ורשומות ביקורת.',
    saved: 'domain_events — מה קרה. outbox_messages — מה יצא החוצה (published_at לא ריק). audit_entries — מי נגע. הכל ב-Postgres שב-Docker, לא בזיכרון הדפדפן.',
    verify: 'Docker: סננו domain_events ו-outbox_messages לפי aggregate/session id. חייב להיות אירוע אחד למשימה הזו, ו-published_at מלא.',
    links: [editor],
  },
  dlq: {
    did: 'ops הזריק משימה שנכשלת בכוונה (POST /api/v1/ops/dlq/failures). ה-worker תפס שגיאת VALIDATION ושם אותה בבידוד במקום למחוק.',
    saved: 'dlq_items (סטטוס OPEN + הטקסט Job sent to quarantine…), job_attempts, ו-agent_sessions של המשימה הכושלת. Redis החזיק את העבודה עד הכישלון.',
    verify: 'Docker → dlq_items: שורה OPEN עם original_error. אם אין שורה — הכשל נעלם, וזה רע. אל תסגרו את מסך הטבלאות לפני שהלקוח רואה את השורה.',
    links: [editor],
  },
  replay: {
    did: 'ops שיחזר את פריט הבידוד עם הסיבה «שחזור אחרי כשל נראה». ה-worker הריץ שוב את המשימה עד COMPLETED. השחזור עצמו מתועד.',
    saved: 'dlq_replays (מי, מתי, סיבה). dlq_items מתעדכן. agent_sessions של המשימה המשוחזרת → COMPLETED. audit_entries נוספות.',
    verify: 'Docker → dlq_replays: שורה חדשה עם הסיבה העברית. agent_sessions של ה-session שחזר: COMPLETED. אמרו ללקוח: «הכשל לא נמחק — תיקנו אותו עם חתימה».',
    links: [editor],
  },
};

export const MACHINE = {
  folder: '/Users/jonathangad/ItayChai',
  env: '/Users/jonathangad/ItayChai/.env',
  postgres: '127.0.0.1:54322 · מכולת Docker של המסד',
  redis: '127.0.0.1:6379 · מכולת Docker של Redis',
};

export const B_EXPLAIN: StepExplain = {
  did: 'עכשיו אתם עסק ב׳. המערכת נכנסה כ-owner-b@example.com וניסתה לקרוא ולשנות את עסק א׳. השרת החזיר 403 / אין חברות בעסק.',
  saved: 'לא הועתקה אף משימה לשולחן ב׳. הנתונים של א׳ נשארו ב-agent_sessions עם tenant_id של א׳ בלבד.',
  verify: 'פתחו Docker → agent_sessions: משימות א׳ עדיין עם tenant …0001. עסק ב׳ (…0002) לא קיבל אותן. דף הקישורים מראה גם את דופק השרת.',
  links: [editor, look, { label: 'חזרה למסך ההוכחה', href: PREVIEW.owner }],
};
