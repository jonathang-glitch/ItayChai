import { shiftEdges, withEdge } from './owner-week-parts';
import type { ShopSchedule } from './types';

type Props = {
  schedule: ShopSchedule;
  onChange: (schedule: ShopSchedule) => void;
};

export function ShiftHours({ schedule, onChange }: Props) {
  const { edges, names, custom, fits } = shiftEdges(schedule);
  const last = names.length - 1;

  return (
    <>
      <ul className="ws-shifts">
        {names.map((name, index) => (
          <li key={name}>
            <b>{name}</b>
            <div className="ws-times">
              <label>
                {index === 0 ? 'פתיחה' : 'מתחילה'}
                <input
                  type="time"
                  step={300}
                  value={edges[index] ?? ''}
                  onChange={(event) =>
                    event.target.value && onChange(withEdge(schedule, index, event.target.value))
                  }
                />
              </label>
              <label>
                {index === last ? 'סגירה' : 'נגמרת'}
                <input
                  type="time"
                  step={300}
                  value={edges[index + 1] ?? ''}
                  onChange={(event) =>
                    event.target.value &&
                    onChange(withEdge(schedule, index + 1, event.target.value))
                  }
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
      <div className="ws-shift-foot">
        {fits ? (
          <span>
            {custom ? 'השעות שקבעתם.' : 'כרגע מחולק שווה. משנים שעה, והמשמרת הבאה זזה איתה.'}
          </span>
        ) : (
          <span className="ws-warn-text">
            כל משמרת צריכה להיות לפחות שעה, והשעות צריכות להתקדם לפי הסדר.
          </span>
        )}
        {custom ? (
          <button
            type="button"
            className="ws-more"
            onClick={() => onChange({ ...schedule, splits: [] })}
          >
            חלוקה שווה
          </button>
        ) : null}
      </div>
    </>
  );
}
