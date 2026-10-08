import { dayLabel } from './owner-week-parts';
import type { WeekPlan } from './types';
import './owner-week-board.css';

type Props = {
  plan: WeekPlan;
  busy: boolean;
  onAsk: () => void;
  onAssign: (employeeId: string, slotId: string) => void;
  onRemove: (shiftId: string) => void;
};

function clock(value: string) {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

export function WeekBoard({ plan, busy, onAsk, onAssign, onRemove }: Props) {
  const { slots } = plan;
  const days = [...new Set(slots.map((slot) => slot.id.slice(0, 10)))];
  const full = slots.filter((slot) => slot.people.length >= slot.needed).length;
  const short = plan.gaps.filter((gap) => gap.short || gap.weekendShort);

  if (!slots.length) {
    return (
      <section className="wk-card wb-empty">
        <strong>עוד אין שבוע</strong>
        <p>מסיימים את ההגדרות למעלה ולוחצים על ״בונים את השבוע הבא״. המשמרות יופיעו כאן.</p>
      </section>
    );
  }

  return (
    <section className="wk-card">
      <header className="wb-head">
        <div>
          <h3>השבוע הבא</h3>
          <p>
            {dayLabel(days[0] ?? '')} עד {dayLabel(days[days.length - 1] ?? '')}
          </p>
        </div>
        <button type="button" className="wb-ask" disabled={busy} onClick={onAsk}>
          שליחה לצוות בוואטסאפ
        </button>
      </header>

      <div className="wb-progress" aria-label={`${full} מתוך ${slots.length} משמרות מלאות`}>
        <div>
          <span style={{ width: `${Math.round((full / slots.length) * 100)}%` }} />
        </div>
        <p>
          <b>{full}</b> מתוך {slots.length} משמרות מלאות
        </p>
      </div>

      {short.length ? (
        <p className="wb-gaps">עוד לא הגיעו למינימום: {short.map((gap) => gap.name).join(', ')}</p>
      ) : null}

      <div className="wb-days">
        {days.map((day) => (
          <article key={day} className="wb-day">
            <h4>{dayLabel(day)}</h4>
            {slots
              .filter((slot) => slot.id.startsWith(day))
              .map((slot) => {
                const done = slot.people.length >= slot.needed;
                const free = plan.workers.filter(
                  (worker) => !slot.people.some((person) => person.employeeId === worker.id),
                );
                return (
                  <div key={slot.id} className={done ? 'wb-slot done' : 'wb-slot'}>
                    <div className="wb-slot-top">
                      <strong>{slot.part}</strong>
                      <span>
                        {clock(slot.startsAt)}–{clock(slot.endsAt)}
                      </span>
                      <b>
                        {slot.people.length}/{slot.needed}
                      </b>
                    </div>
                    <div className="wb-people">
                      {slot.people.map((person) => (
                        <span key={person.shiftId} className="chip">
                          {person.name}
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`מסירים את ${person.name}`}
                            onClick={() => onRemove(person.shiftId)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {!done && free.length ? (
                        <select
                          value=""
                          disabled={busy}
                          aria-label={`שיבוץ ל${slot.part}`}
                          onChange={(event) =>
                            event.target.value && onAssign(event.target.value, slot.id)
                          }
                        >
                          <option value="">+ שיבוץ</option>
                          {free.map((worker) => (
                            <option key={worker.id} value={worker.id}>
                              {worker.displayName}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </div>
                );
              })}
          </article>
        ))}
      </div>
    </section>
  );
}
