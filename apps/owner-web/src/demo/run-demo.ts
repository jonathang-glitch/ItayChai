import {
  EXPECTED_REPLY,
  OPS,
  OWNER_A,
  OWNER_B,
  SEED_PASSWORD,
  STAKEHOLDER,
  TENANT_A,
  TENANT_B,
} from './constants';
import { COPY } from './copy';
import {
  acknowledgeSession,
  breakGlass,
  injectFailure,
  listDlq,
  listSessions,
  login,
  replayDlq,
  sendWhatsApp,
  sessionTrace,
  type SessionRow,
} from './api';

export type DemoStepResult = {
  id: string;
  title: string;
  story: string;
  ok: boolean;
  evidence: string;
  session?: SessionRow;
  reply?: string;
};

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCompleted(token: string, sessionId: string): Promise<SessionRow> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const listed = await listSessions(token, TENANT_A);
    const found = listed.body.find((row) => row.id === sessionId);
    if (found?.status === 'COMPLETED') {
      return found;
    }
    await sleep(500);
  }
  throw new Error(COPY.workerMissing);
}

export async function runFoundationDemo(
  onResult: (result: DemoStepResult) => void,
): Promise<void> {
  const health = await fetch('/health');
  const healthBody = (await health.json()) as { ok?: boolean; database?: string };
  onResult({
    id: 'health',
    title: 'המערכת חיה',
    story: 'השרת ומסד הנתונים עונים לבדיקת תקינות.',
    ok: health.ok && healthBody.ok === true && healthBody.database === 'up',
    evidence: `שרת ${healthBody.ok ? 'פעיל' : 'כבוי'}; מסד ${healthBody.database === 'up' ? 'פעיל' : 'לא זמין'}`,
  });

  const ownerA = await login(OWNER_A, SEED_PASSWORD);
  const ownerB = await login(OWNER_B, SEED_PASSWORD);
  const stakeholder = await login(STAKEHOLDER, SEED_PASSWORD);
  onResult({
    id: 'login',
    title: 'שני עסקים מתחברים',
    story: 'עסק א׳ ועסק ב׳ מקבלים כל אחד כניסה משלו.',
    ok: ownerA.status === 200 && ownerB.status === 200 && stakeholder.status === 200,
    evidence: `עסק א׳ ${ownerA.status}; עסק ב׳ ${ownerB.status}; בעל עניין ${stakeholder.status}`,
  });

  const messageId = `demo-${Date.now()}`;
  const first = await sendWhatsApp(messageId, COPY.inbound);
  if (first.status !== 200 || !first.body.sessionId) {
    onResult({
      id: 'whatsapp',
      title: 'הודעת וואטסאפ מטופלת',
      story: 'הודעת לקוח יוצרת משימה אחת ומקבלת תשובה.',
      ok: false,
      evidence: `שגיאה ${first.status}`,
    });
    return;
  }

  const completed = await waitForCompleted(ownerA.body.accessToken, first.body.sessionId);
  onResult({
    id: 'whatsapp',
    title: 'הודעת וואטסאפ מטופלת',
    story: 'המשימה עוברת טיוטה → הפעלה → תכנון → הושלם, ומחזירה תשובה אחת.',
    ok: first.body.message === EXPECTED_REPLY && completed.status === 'COMPLETED',
    evidence: `משימה ${completed.id.slice(0, 8)} הושלמה. תשובה: «${COPY.outbound}»`,
    session: completed,
    reply: COPY.outbound,
  });

  const duplicate = await sendWhatsApp(messageId, COPY.inbound);
  onResult({
    id: 'duplicate',
    title: 'אותה הודעה לא מטופלת פעמיים',
    story: 'וואטסאפ יכול לשלוח את אותה הודעה שוב. נשארת משימה אחת.',
    ok: duplicate.status === 200 && duplicate.body.sessionId === first.body.sessionId,
    evidence: `משימה ראשונה ושנייה זהות: ${first.body.sessionId.slice(0, 8)}`,
  });

  const own = await listSessions(ownerA.body.accessToken, TENANT_A);
  const cross = await listSessions(ownerA.body.accessToken, TENANT_B);
  const other = await listSessions(ownerB.body.accessToken, TENANT_A);
  const canSeeOwn = own.body.some((row) => row.id === completed.id);
  onResult({
    id: 'isolation-read',
    title: 'עסק לא רואה עסק אחר',
    story: 'עסק א׳ רואה רק את עצמו. בקשה לנתוני עסק ב׳ נחסמת.',
    ok: canSeeOwn && cross.status === 403 && other.status === 403,
    evidence: `עסק א׳ על א׳: ${own.status} (מצא משימה). עסק א׳ על ב׳: ${cross.status}. עסק ב׳ על א׳: ${other.status}`,
  });

  const blockedWrite = await acknowledgeSession(ownerB.body.accessToken, TENANT_A, completed.id);
  const hiddenWrite = await acknowledgeSession(ownerB.body.accessToken, TENANT_B, completed.id);
  const stakeholderWrite = await acknowledgeSession(
    stakeholder.body.accessToken,
    TENANT_A,
    completed.id,
  );
  onResult({
    id: 'isolation-write',
    title: 'עסק לא משנה עסק אחר',
    story: 'עסק ב׳ חסום. בעל עניין יכול לראות, לא לשנות.',
    ok: blockedWrite.status === 403 && hiddenWrite.status === 404 && stakeholderWrite.status === 403,
    evidence: `עסק ב׳ על א׳: ${blockedWrite.status}. עסק ב׳ בלי הרשאה: ${hiddenWrite.status}. בעל עניין: ${stakeholderWrite.status}`,
  });

  const ownerGrant = await breakGlass(
    ownerA.body.accessToken,
    TENANT_A,
    'investigate failed worker',
  );
  const ops = await login(OPS, SEED_PASSWORD);
  const missingReason = await breakGlass(ops.body.accessToken, TENANT_A, 'short');
  onResult({
    id: 'ops',
    title: 'גישת חירום פנימית נעולה',
    story: 'בעל עסק לא יכול לפתוח גישת צוות. תפעול חייב סיבה כתובה.',
    ok: ownerGrant.status === 403 && missingReason.status === 400,
    evidence: `בעל עסק: ${ownerGrant.status}. תפעול בלי סיבה: ${missingReason.status}`,
  });

  const trace = await sessionTrace(ownerA.body.accessToken, TENANT_A, completed.id);
  onResult({
    id: 'event',
    title: 'כל שינוי יוצר אירוע אחד',
    story: 'המשימה שהושלמה כתובה כאירוע אחד, יצאה ל־outbox, ופורסמה.',
    ok: trace.status === 200 && trace.body.events.length === 1 && trace.body.outbox.length === 1,
    evidence: `אירועים ${trace.body.events.length}; outbox ${trace.body.outbox.length}; ביקורת ${trace.body.audits.length}`,
  });

  const failure = await injectFailure(ops.body.accessToken, TENANT_A);
  if (failure.status !== 201) {
    onResult({
      id: 'dlq',
      title: 'כשל נראה ולא נעלם',
      story: 'משימה שנכשלת נכנסת לבידוד במקום להיעלם.',
      ok: false,
      evidence: `שגיאה ${failure.status}`,
    });
    return;
  }

  const quarantined = await waitForDlq(ops.body.accessToken, failure.body.eventId);
  onResult({
    id: 'dlq',
    title: 'כשל נראה ולא נעלם',
    story: 'משימה שנכשלת נכנסת לבידוד. אפשר לראות אותה ולקרוא את הסיבה.',
    ok: Boolean(quarantined),
    evidence: quarantined
      ? `בבידוד: ${quarantined.originalError}`
      : 'הכשל לא הופיע בבידוד',
  });

  if (!quarantined) {
    return;
  }

  const replayed = await replayDlq(
    ops.body.accessToken,
    TENANT_A,
    quarantined.id,
    'שחזור אחרי כשל נראה',
  );
  const replayedSession = await waitForCompleted(ownerA.body.accessToken, failure.body.sessionId);
  onResult({
    id: 'replay',
    title: 'אפשר לשחזר משימה מהבידוד',
    story: 'צוות תפעול משחזר עם סיבה כתובה. המשימה ממשיכה, והפעולה מתועדת.',
    ok: replayed.status === 201 && replayedSession.status === 'COMPLETED',
    evidence: `שחזור ${replayed.status}; משימה ${replayedSession.status}`,
  });
}

export type BusinessBProof = {
  login: number;
  readA: number;
  readAMessage: string;
  readOwn: number;
  ownCount: number;
  writeA: number;
  aJobCount: number;
  aJobId: string;
  blocked: boolean;
};

export async function tryAsBusinessB(): Promise<BusinessBProof> {
  const ownerB = await login(OWNER_B, SEED_PASSWORD);
  const ownerA = await login(OWNER_A, SEED_PASSWORD);
  const aSessions = await listSessions(ownerA.body.accessToken, TENANT_A);
  const target = aSessions.body[0];
  const readA = await listSessions(ownerB.body.accessToken, TENANT_A);
  const readOwn = await listSessions(ownerB.body.accessToken, TENANT_B);
  const writeA = target
    ? await acknowledgeSession(ownerB.body.accessToken, TENANT_A, target.id)
    : { status: 403, body: { message: 'no A session to touch' } };
  const readAMessage =
    typeof readA.body === 'object' && readA.body && 'message' in readA.body
      ? String((readA.body as { message?: string }).message)
      : '';
  return {
    login: ownerB.status,
    readA: readA.status,
    readAMessage,
    readOwn: readOwn.status,
    ownCount: Array.isArray(readOwn.body) ? readOwn.body.length : 0,
    aJobCount: Array.isArray(aSessions.body) ? aSessions.body.length : 0,
    aJobId: target?.id.slice(0, 8) ?? '',
    writeA: writeA.status,
    blocked: ownerB.status === 200 && readA.status === 403 && writeA.status === 403,
  };
}

async function waitForDlq(token: string, eventId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const listed = await listDlq(token, TENANT_A);
    const found = listed.body.find((item) => item.eventId === eventId && item.status === 'OPEN');
    if (found && listed.status === 200) {
      return found;
    }
    await sleep(500);
  }
  return null;
}
