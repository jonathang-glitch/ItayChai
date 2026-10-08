import { useEffect, useMemo, useState } from 'react';
import { pickBlock, pickRefusal, type ShopSchedule, type WeekSlot } from '@itay-chai/domain';
import { requestJson } from '../client/api';
import { PickDay, dayTitle } from './pick-day';
import '../client/client.css';
import './pick.css';

export type PickPageSlot = WeekSlot & { takenByOthers: number; past: boolean; mine: boolean };

type PickPage = {
  shopName: string;
  workerName: string;
  schedule: ShopSchedule;
  rules: string[];
  busyDays: string[];
  slots: PickPageSlot[];
};

type Failure = { message?: string };

function count(n: number) {
  return n === 1 ? 'משמרת אחת' : `${n} משמרות`;
}

export function PickApp({ token }: { token: string }) {
  const path = `/api/v1/pick/${encodeURIComponent(token)}`;
  const [page, setPage] = useState<PickPage | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function take(next: PickPage) {
    setPage(next);
    setChosen(new Set(next.slots.filter((slot) => slot.mine).map((slot) => slot.id)));
  }

  useEffect(() => {
    let cancelled = false;
    void requestJson<PickPage & Failure>(path).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.status === 200) {
        take(result.body);
      } else {
        setError(result.body.message ?? 'לא הצלחנו לפתוח את הסידור. נסו שוב בעוד רגע.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const live = useMemo(
    () => (page ? page.slots.filter((slot) => !slot.past || slot.mine) : []),
    [page],
  );
  const days = useMemo(
    () => [...new Set((page?.slots ?? []).map((slot) => slot.id.slice(0, 10)))],
    [page],
  );

  if (error || !page) {
    return (
      <main className="pk pk-center">
        <p>{error ?? 'טוענים את הסידור…'}</p>
      </main>
    );
  }

  const rules = { schedule: page.schedule, slots: live, busyDays: page.busyDays };
  const refusal = pickRefusal({ ...rules, picks: [...chosen] });
  const dirty = page.slots.some((slot) => slot.mine !== chosen.has(slot.id));

  function tap(slot: PickPageSlot) {
    const next = new Set(chosen);
    if (next.has(slot.id)) {
      next.delete(slot.id);
    } else {
      for (const other of page?.slots ?? []) {
        if (other.id.slice(0, 10) === slot.id.slice(0, 10) && !other.past) {
          next.delete(other.id);
        }
      }
      next.add(slot.id);
      const blocked = pickBlock({ ...rules, picks: [...next] });
      if (blocked) {
        setHint(blocked);
        return;
      }
    }
    setHint(null);
    setSaved(false);
    setChosen(next);
  }

  async function save() {
    setBusy(true);
    setHint(null);
    const result = await requestJson<PickPage & Failure>(path, {
      method: 'PUT',
      body: JSON.stringify({ slotIds: [...chosen] }),
    });
    setBusy(false);
    if (result.status === 200) {
      take(result.body);
      setSaved(true);
      return;
    }
    setHint(result.body.message ?? 'לא נשמר. נסו שוב.');
  }

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  return (
    <main className="pk">
      <header className="pk-head">
        <span className="pk-shop">{page.shopName}</span>
        <h1>היי {page.workerName}, אילו משמרות מתאימות לך?</h1>
        {firstDay && lastDay ? (
          <p>
            {dayTitle(firstDay)} עד {dayTitle(lastDay)}
          </p>
        ) : null}
        <ul className="pk-rules">
          {page.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </header>

      {days.length ? (
        days.map((day) => (
          <PickDay
            key={day}
            day={day}
            needed={page.schedule.needed}
            busy={page.busyDays.includes(day)}
            chosen={chosen}
            slots={page.slots.filter((slot) => slot.id.startsWith(day))}
            onTap={tap}
          />
        ))
      ) : (
        <p className="pk-empty">עוד אין משמרות פתוחות. העסק ישלח קישור כשהסידור יהיה מוכן.</p>
      )}

      <footer className="pk-bar">
        {hint ? <p className="pk-hint">{hint}</p> : null}
        {saved && !dirty && !hint ? (
          <p className="pk-saved" role="status">
            <b>✓</b>
            <span>
              <strong>נשמר!</strong>{' '}
              {chosen.size ? `${count(chosen.size)} נשמרו בסידור.` : 'הסרת את כל המשמרות.'} אפשר
              לחזור לקישור ולשנות בכל רגע.
            </span>
          </p>
        ) : null}
        <div className="pk-bar-row">
          <div>
            <strong>{chosen.size ? `בחרת ${count(chosen.size)}` : 'עוד לא בחרת'}</strong>
            <span className={refusal ? 'pk-warn' : dirty ? 'pk-pending' : 'pk-ok'}>
              {refusal ?? (dirty ? 'יש שינויים שעוד לא נשמרו' : 'המשמרות שלך שמורות')}
            </span>
          </div>
          <button
            type="button"
            className={!dirty && !busy ? 'pk-done' : ''}
            disabled={busy || !dirty || Boolean(refusal)}
            onClick={() => void save()}
          >
            {busy ? 'שומרים…' : dirty ? 'שמירה' : 'נשמר ✓'}
          </button>
        </div>
      </footer>
    </main>
  );
}
