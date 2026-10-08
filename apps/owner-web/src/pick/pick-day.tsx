import type { PickPageSlot } from './pick-app';

type Props = {
  day: string;
  slots: PickPageSlot[];
  needed: number;
  busy: boolean;
  chosen: Set<string>;
  onTap: (slot: PickPageSlot) => void;
};

const clock = new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jerusalem',
});

export function dayTitle(day: string) {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

function status(slot: PickPageSlot, needed: number, on: boolean, busy: boolean) {
  if (on) {
    return 'נבחרה';
  }
  if (slot.past) {
    return 'עברה';
  }
  if (busy) {
    return 'יש לך משמרת אחרת ביום הזה';
  }
  const left = needed - slot.takenByOthers;
  if (left <= 0) {
    return 'מלאה';
  }
  if (left === needed) {
    return 'פנויה';
  }
  return left === 1 ? 'מקום אחרון' : `נשארו ${left}`;
}

export function PickDay({ day, slots, needed, busy, chosen, onTap }: Props) {
  return (
    <section className="pk-day">
      <h2>{dayTitle(day)}</h2>
      <div className="pk-slots">
        {slots.map((slot) => {
          const on = chosen.has(slot.id);
          const closed = !on && (slot.past || busy || slot.takenByOthers >= needed);
          return (
            <button
              key={slot.id}
              type="button"
              aria-pressed={on}
              disabled={closed || (slot.past && on)}
              className={on ? 'pk-slot on' : closed ? 'pk-slot closed' : 'pk-slot'}
              onClick={() => onTap(slot)}
            >
              <span className="pk-check" aria-hidden="true">
                {on ? '✓' : ''}
              </span>
              <strong>{slot.part}</strong>
              <span className="pk-hours">
                {clock.format(new Date(slot.startsAt))}–{clock.format(new Date(slot.endsAt))}
              </span>
              <em>{status(slot, needed, on, busy)}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
