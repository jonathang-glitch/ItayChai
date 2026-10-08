import { useState, type ReactNode } from 'react';
import { ShiftHours } from './owner-week-hours';
import { DAYS, RULES, SPLITS, Stepper, Switch, dayLabel } from './owner-week-parts';
import type { ShopSchedule, WeekPlan } from './types';
import './owner-week-setup.css';

type Props = {
  schedule: ShopSchedule;
  holidays: WeekPlan['holidays'];
  onChange: (schedule: ShopSchedule) => void;
};

const FIRST_HOLIDAYS = 5;

function Step({
  index,
  title,
  lede,
  tag,
  children,
}: {
  index: number;
  title: string;
  lede: string;
  tag?: string;
  children: ReactNode;
}) {
  return (
    <section className="wk-card">
      <header className="ws-head">
        <span className="ws-step">{index}</span>
        <div>
          <h3>
            {title}
            {tag ? <small>{tag}</small> : null}
          </h3>
          <p>{lede}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function WeekSetup({ schedule, holidays, onChange }: Props) {
  const [closedOn, setClosedOn] = useState('');
  const [allHolidays, setAllHolidays] = useState(false);
  const shownHolidays = allHolidays ? holidays : holidays.slice(0, FIRST_HOLIDAYS);
  const set = (patch: Partial<ShopSchedule>) => onChange({ ...schedule, ...patch });

  return (
    <>
      <Step index={1} title="באילו ימים פתוחים" lede="מסמנים את ימי הפעילות בשבוע.">
        <div className="ws-days">
          {DAYS.map(([mark, name], index) => {
            const on = schedule.openDays.includes(index);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                className={on ? 'on' : ''}
                onClick={() =>
                  set({
                    openDays: on
                      ? schedule.openDays.filter((day) => day !== index)
                      : [...schedule.openDays, index].sort(),
                  })
                }
              >
                <b>{mark}</b>
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step
        index={2}
        title="שעות ומשמרות"
        lede="בוחרים כמה משמרות יש ביום, ומתי כל אחת מתחילה ונגמרת."
      >
        <div className="ws-segment" role="radiogroup" aria-label="חלוקת משמרות">
          {SPLITS.map((split) => (
            <button
              key={split.value}
              type="button"
              role="radio"
              aria-checked={schedule.parts === split.value}
              className={schedule.parts === split.value ? 'on' : ''}
              onClick={() => set({ parts: split.value, splits: [] })}
            >
              {split.label}
            </button>
          ))}
        </div>
        <ShiftHours schedule={schedule} onChange={onChange} />
        <div className="ws-row">
          <div>
            <strong>כמה אנשים בכל משמרת</strong>
            <em>משמרת נחשבת מלאה כשיש בה את המספר הזה</em>
          </div>
          <Stepper
            label="כמה אנשים בכל משמרת"
            value={schedule.needed}
            min={1}
            max={8}
            onChange={(needed) => set({ needed })}
          />
        </div>
      </Step>

      <Step
        index={3}
        title="חגים וימים סגורים"
        lede="בחגים סוגרים אוטומטית. אפשר לפתוח חג, או להוסיף יום סגור משלכם."
      >
        <ul className="ws-list">
          {shownHolidays.map((holiday) => {
            const closed = !schedule.skippedHolidays.includes(holiday.date);
            return (
              <li key={holiday.date}>
                <div>
                  <strong>{holiday.name}</strong>
                  <em>{dayLabel(holiday.date)}</em>
                </div>
                <span className={closed ? 'ws-state' : 'ws-state open'}>
                  {closed ? 'סגור' : 'פתוח'}
                </span>
                <Switch
                  on={closed}
                  label={`${holiday.name} סגור`}
                  onChange={(on) =>
                    set({
                      skippedHolidays: on
                        ? schedule.skippedHolidays.filter((date) => date !== holiday.date)
                        : [...schedule.skippedHolidays, holiday.date],
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
        {holidays.length > FIRST_HOLIDAYS ? (
          <button type="button" className="ws-more" onClick={() => setAllHolidays(!allHolidays)}>
            {allHolidays ? 'פחות חגים' : `עוד ${holidays.length - FIRST_HOLIDAYS} חגים`}
          </button>
        ) : null}
        <form
          className="ws-close"
          onSubmit={(event) => {
            event.preventDefault();
            if (closedOn && !schedule.closedDates.includes(closedOn)) {
              set({ closedDates: [...schedule.closedDates, closedOn].sort() });
            }
            setClosedOn('');
          }}
        >
          <input
            type="date"
            value={closedOn}
            onChange={(event) => setClosedOn(event.target.value)}
            required
            aria-label="יום סגור"
          />
          <button type="submit">הוספת יום סגור</button>
        </form>
        {schedule.closedDates.length ? (
          <div className="ws-chips">
            {schedule.closedDates.map((date) => (
              <span key={date} className="chip">
                {dayLabel(date)}
                <button
                  type="button"
                  aria-label={`פותחים את ${dayLabel(date)}`}
                  onClick={() =>
                    set({ closedDates: schedule.closedDates.filter((day) => day !== date) })
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </Step>

      <Step
        index={4}
        title="כללים לצוות"
        tag="לא חובה"
        lede="בלי כללים, קובע רק כמה אנשים צריך במשמרת. מדליקים רק מה שחשוב לכם."
      >
        <ul className="ws-list">
          {RULES.map((rule) => {
            const value = schedule[rule.key];
            return (
              <li key={rule.key} className={value ? 'on' : ''}>
                <div>
                  <strong>{rule.label}</strong>
                  <em>{rule.hint}</em>
                </div>
                {value ? (
                  <Stepper
                    label={rule.label}
                    value={value}
                    min={1}
                    max={rule.max}
                    onChange={(next) => set({ [rule.key]: next })}
                  />
                ) : null}
                <Switch
                  on={value > 0}
                  label={rule.label}
                  onChange={(on) => set({ [rule.key]: on ? 1 : 0 })}
                />
              </li>
            );
          })}
        </ul>
      </Step>
    </>
  );
}
