import { dayParts, splitsFit } from '@itay-chai/domain';
import type { ShopSchedule } from './types';
import './owner-week-parts.css';

export const DAYS = [
  ['א', 'ראשון'],
  ['ב', 'שני'],
  ['ג', 'שלישי'],
  ['ד', 'רביעי'],
  ['ה', 'חמישי'],
  ['ו', 'שישי'],
  ['ש', 'שבת'],
] as const;

export const SPLITS = [
  { value: 1, label: 'משמרת אחת' },
  { value: 2, label: 'בוקר וערב' },
  { value: 3, label: 'שלוש משמרות' },
] as const;

export const RULES = [
  { key: 'minShifts', label: 'מינימום משמרות לעובד', hint: 'בכל שבוע', max: 7 },
  { key: 'maxShifts', label: 'מקסימום משמרות לעובד', hint: 'כדי שאף אחד לא יישחק', max: 7 },
  { key: 'minWeekend', label: 'מינימום משמרות סוף שבוע', hint: 'שישי ושבת', max: 2 },
  { key: 'maxWeekend', label: 'מקסימום משמרות סוף שבוע', hint: 'שישי ושבת', max: 2 },
] as const;

export function shiftEdges(schedule: ShopSchedule) {
  const equal = dayParts({ ...schedule, splits: [] });
  const custom = schedule.splits.length === schedule.parts - 1 && schedule.parts > 1;
  const inner = custom ? schedule.splits : equal.slice(1).map((part) => part.start);
  const opensAt = schedule.opensAt.slice(0, 5);
  const closesAt = schedule.closesAt.slice(0, 5);
  const fits = custom ? splitsFit(opensAt, closesAt, schedule.parts, inner) : equal.length > 0;
  const names = dayParts({ ...schedule, opensAt: '00:00', closesAt: '23:59', splits: [] }).map(
    (part) => part.part,
  );
  return { edges: [opensAt, ...inner, closesAt], names, custom, fits };
}

export function withEdge(schedule: ShopSchedule, index: number, value: string): ShopSchedule {
  const { edges } = shiftEdges(schedule);
  if (index === 0) {
    return { ...schedule, opensAt: value };
  }
  if (index === edges.length - 1) {
    return { ...schedule, closesAt: value };
  }
  const next = [...edges];
  next[index] = value;
  return { ...schedule, splits: next.slice(1, -1) };
}

export function dayLabel(dayKey: string) {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

type StepperProps = {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
};

export function Stepper({ value, min, max, label, onChange }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="פחות"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output>{value}</output>
      <button
        type="button"
        aria-label="יותר"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

type SwitchProps = { on: boolean; label: string; onChange: (on: boolean) => void };

export function Switch({ on, label, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}
