import { useEffect, useState } from 'react';
import {
  askRosterWeek,
  assignRosterSlot,
  buildRosterWeek,
  deleteRosterShift,
  getRosterWeek,
  saveRosterWeek,
} from './api';
import { COPY, rosterFailure } from './copy';
import { WeekBoard } from './owner-week-board';
import { shiftEdges } from './owner-week-parts';
import { WeekSetup } from './owner-week-setup';
import { membershipOf } from './session';
import type { AuthSession, ShopSchedule, WeekPlan } from './types';
import './owner-week.css';

type Props = { session: AuthSession };
type Note = { tone: 'good' | 'bad'; text: string };

function ready(schedule: ShopSchedule): ShopSchedule {
  return {
    ...schedule,
    opensAt: schedule.opensAt.slice(0, 5),
    closesAt: schedule.closesAt.slice(0, 5),
    parts: Number(schedule.parts) as 1 | 2 | 3,
    needed: Number(schedule.needed) || 1,
    minShifts: Number(schedule.minShifts) || 0,
    maxShifts: Number(schedule.maxShifts) || 0,
    minWeekend: Number(schedule.minWeekend) || 0,
    maxWeekend: Number(schedule.maxWeekend) || 0,
  };
}

export function OwnerWeek({ session }: Props) {
  const membership = membershipOf(session);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [schedule, setSchedule] = useState<ShopSchedule | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!membership) {
      return;
    }
    let cancelled = false;
    void getRosterWeek(session.accessToken, membership.tenantId).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.status === 200 && result.body.schedule) {
        setPlan(result.body);
        setSchedule(result.body.schedule);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [membership, session.accessToken, attempt]);

  if (!membership || !plan || !schedule) {
    return (
      <div className="wk-loading">
        {failed ? (
          <>
            <p>לא הצלחנו לטעון את הסידור.</p>
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt(attempt + 1);
              }}
            >
              מנסים שוב
            </button>
          </>
        ) : (
          <p>{COPY.loadingShifts}</p>
        )}
      </div>
    );
  }

  const tenantId = membership.tenantId;
  const token = session.accessToken;
  const perDay = shiftEdges(schedule).fits ? schedule.parts : 0;
  const built = plan.slots.length > 0;
  const changed = JSON.stringify(ready(schedule)) !== JSON.stringify(ready(plan.schedule));

  function take(status: number, body: unknown) {
    const next = body as WeekPlan | undefined;
    if (status === 200 && next?.schedule) {
      setPlan(next);
      setSchedule(next.schedule);
      return true;
    }
    setNote({ tone: 'bad', text: rosterFailure(body) });
    return false;
  }

  function run(task: () => Promise<void>) {
    if (busy) {
      return;
    }
    setBusy(true);
    setNote(null);
    void task().finally(() => setBusy(false));
  }

  const build = () =>
    run(async () => {
      const saved = await saveRosterWeek(token, tenantId, ready(schedule));
      if (!take(saved.status, saved.body)) {
        return;
      }
      const result = await buildRosterWeek(token, tenantId);
      if (take(result.status, result.body)) {
        setNote(
          result.body.slots.length
            ? {
                tone: 'good',
                text: `השבוע מוכן: ${result.body.slots.length} משמרות. משבצים כאן, או שולחים לצוות שיבחר.`,
              }
            : { tone: 'bad', text: 'לא נוצרו משמרות. בדקו שיש ימים פתוחים ושעות תקינות.' },
        );
      }
    });

  const ask = () =>
    run(async () => {
      const result = await askRosterWeek(token, tenantId);
      if (result.status !== 200) {
        setNote({ tone: 'bad', text: rosterFailure(result.body) });
        return;
      }
      const queued = result.body.queued ?? result.body.sent;
      setNote(
        queued > 0
          ? {
              tone: 'good',
              text: `נשלח ל-${queued} בוואטסאפ. הם עונים במספר משמרת, או למשל ״ראשון בוקר״.`,
            }
          : { tone: 'bad', text: 'לא נשלח. לאף אחד בצוות אין מספר שמחובר לוואטסאפ.' },
      );
    });

  return (
    <div className="wk">
      <header className="wk-intro">
        <h2>סידור עבודה</h2>
        <p>מגדירים פעם אחת איך העסק עובד, והשבוע נבנה לבד.</p>
      </header>

      <WeekSetup schedule={schedule} holidays={plan.holidays} onChange={setSchedule} />

      <div className="wk-bar">
        <div>
          <strong>
            {schedule.openDays.length} ימים · {perDay} משמרות ביום
          </strong>
          <span>{changed ? 'יש שינויים שעוד לא נשמרו' : 'הכל שמור'}</span>
        </div>
        <button
          className="primary"
          type="button"
          disabled={busy || !schedule.openDays.length || !perDay}
          onClick={build}
        >
          {busy ? 'רגע…' : built ? 'עדכון השבוע' : 'בונים את השבוע הבא'}
        </button>
      </div>

      {note ? <p className={`wk-note ${note.tone}`}>{note.text}</p> : null}

      <WeekBoard
        plan={plan}
        busy={busy}
        onAsk={ask}
        onAssign={(employeeId, slotId) =>
          run(async () => {
            const result = await assignRosterSlot(token, tenantId, employeeId, slotId);
            take(result.status, result.body);
          })
        }
        onRemove={(shiftId) =>
          run(async () => {
            const removed = await deleteRosterShift(token, tenantId, shiftId);
            if (removed.status !== 200) {
              setNote({ tone: 'bad', text: rosterFailure(removed.body) });
              return;
            }
            const fresh = await getRosterWeek(token, tenantId);
            take(fresh.status, fresh.body);
          })
        }
      />
    </div>
  );
}
