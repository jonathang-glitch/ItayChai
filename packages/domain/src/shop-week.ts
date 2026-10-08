import { jerusalemDayKey, jerusalemWeekday, shiftLabelFromStart } from '@itay-chai/contracts';

export type ShopSchedule = {
  openDays: number[];
  opensAt: string;
  closesAt: string;
  parts: 1 | 2 | 3;
  splits: string[];
  needed: number;
  minShifts: number;
  maxShifts: number;
  minWeekend: number;
  maxWeekend: number;
  closedDates: string[];
  skippedHolidays: string[];
};

export type WeekSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  part: string;
};

export type Holiday = { date: string; name: string };

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

export const IL_HOLIDAYS: Holiday[] = [
  { date: '2026-04-02', name: 'פסח' },
  { date: '2026-04-08', name: 'שביעי של פסח' },
  { date: '2026-04-22', name: 'יום העצמאות' },
  { date: '2026-05-22', name: 'שבועות' },
  { date: '2026-09-12', name: 'ראש השנה' },
  { date: '2026-09-13', name: 'ראש השנה' },
  { date: '2026-09-21', name: 'יום כיפור' },
  { date: '2026-09-26', name: 'סוכות' },
  { date: '2026-10-03', name: 'שמחת תורה' },
  { date: '2027-04-22', name: 'פסח' },
  { date: '2027-04-28', name: 'שביעי של פסח' },
  { date: '2027-05-12', name: 'יום העצמאות' },
  { date: '2027-06-11', name: 'שבועות' },
  { date: '2027-10-02', name: 'ראש השנה' },
  { date: '2027-10-03', name: 'ראש השנה' },
  { date: '2027-10-11', name: 'יום כיפור' },
  { date: '2027-10-16', name: 'סוכות' },
  { date: '2027-10-23', name: 'שמחת תורה' },
];

export function defaultSchedule(): ShopSchedule {
  return {
    openDays: [0, 1, 2, 3, 4],
    opensAt: '08:00',
    closesAt: '22:00',
    parts: 2,
    splits: [],
    needed: 1,
    minShifts: 0,
    maxShifts: 0,
    minWeekend: 0,
    maxWeekend: 0,
    closedDates: [],
    skippedHolidays: [],
  };
}

function num(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function time(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : fallback;
}

export function readSchedule(raw: unknown): ShopSchedule {
  const base = defaultSchedule();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const body = raw as Partial<ShopSchedule>;
  const openDays = Array.isArray(body.openDays)
    ? [...new Set(body.openDays.map((day) => num(day, -1, 0, 6)).filter((day) => day >= 0))]
    : base.openDays;
  const parts = num(body.parts, base.parts, 1, 3) as 1 | 2 | 3;
  const opensAt = time(body.opensAt, base.opensAt);
  const closesAt = time(body.closesAt, base.closesAt);
  const splits = Array.isArray(body.splits) ? body.splits.map((value) => time(value, '')) : [];
  return {
    openDays: openDays.length ? openDays : base.openDays,
    opensAt,
    closesAt,
    parts,
    splits: splitsFit(opensAt, closesAt, parts, splits) ? splits : [],
    needed: num(body.needed, base.needed, 1, 8),
    minShifts: num(body.minShifts, base.minShifts, 0, 7),
    maxShifts: num(body.maxShifts, base.maxShifts, 0, 7),
    minWeekend: num(body.minWeekend, base.minWeekend, 0, 2),
    maxWeekend: num(body.maxWeekend, base.maxWeekend, 0, 2),
    closedDates: Array.isArray(body.closedDates)
      ? body.closedDates.filter((day) => typeof day === 'string')
      : [],
    skippedHolidays: Array.isArray(body.skippedHolidays)
      ? body.skippedHolidays.filter((day) => typeof day === 'string')
      : [],
  };
}

export function addDayKey(day: string, days: number) {
  const [year, month, date] = day.split('-').map(Number);
  return jerusalemDayKey(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + days, 12)));
}

export function weekDayKeys(now = new Date(), which: 'this' | 'next' = 'this') {
  const today = jerusalemDayKey(now);
  const sunday = addDayKey(today, -jerusalemWeekday(now));
  const start = which === 'next' ? addDayKey(sunday, 7) : sunday;
  return Array.from({ length: 7 }, (_, index) => addDayKey(start, index));
}

export function upcomingHolidays(now = new Date(), days = 120): Holiday[] {
  const start = jerusalemDayKey(now);
  const end = addDayKey(start, days);
  return IL_HOLIDAYS.filter((holiday) => holiday.date >= start && holiday.date <= end);
}

function minutes(clock: string) {
  const [hour, minute] = clock.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function clock(total: number) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function jerusalemInstant(day: string, timeOfDay: string) {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = timeOfDay.split(':').map(Number);
  let utc = Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1, hour ?? 0, minute ?? 0);
  for (let step = 0; step < 3; step += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utc));
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const actual = Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      read('hour'),
      read('minute'),
    );
    const wanted = Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1, hour ?? 0, minute ?? 0);
    utc += wanted - actual;
  }
  return new Date(utc).toISOString();
}

function partName(index: number, count: number) {
  if (count === 1) {
    return 'משמרת';
  }
  if (count === 2) {
    return index === 0 ? 'בוקר' : 'ערב';
  }
  return ['בוקר', 'צהריים', 'ערב'][index] ?? 'משמרת';
}

const MIN_PART = 60;

export function splitsFit(opensAt: string, closesAt: string, parts: number, splits: string[]) {
  if (splits.length !== parts - 1 || splits.some((value) => !value)) {
    return false;
  }
  const edges = [opensAt, ...splits, closesAt].map(minutes);
  return edges.every((edge, index) => index === 0 || edge - (edges[index - 1] ?? 0) >= MIN_PART);
}

export function dayParts(schedule: ShopSchedule) {
  const open = minutes(schedule.opensAt);
  const close = minutes(schedule.closesAt);
  const span = Math.floor((close - open) / schedule.parts / 30) * 30;
  if (close <= open || span < MIN_PART) {
    return [];
  }
  const custom = splitsFit(
    schedule.opensAt,
    schedule.closesAt,
    schedule.parts,
    schedule.splits ?? [],
  );
  const inner = custom
    ? schedule.splits
    : Array.from({ length: schedule.parts - 1 }, (_, index) => clock(open + span * (index + 1)));
  const edges = [schedule.opensAt, ...inner, schedule.closesAt];
  return Array.from({ length: schedule.parts }, (_, index) => ({
    index,
    part: partName(index, schedule.parts),
    start: edges[index] ?? schedule.opensAt,
    end: edges[index + 1] ?? schedule.closesAt,
  }));
}

function closedSet(schedule: ShopSchedule) {
  const holidays = IL_HOLIDAYS.filter(
    (holiday) => !schedule.skippedHolidays.includes(holiday.date),
  ).map((holiday) => holiday.date);
  return new Set([...schedule.closedDates, ...holidays]);
}

export function buildWeekSlots(
  schedule: ShopSchedule,
  now = new Date(),
  which: 'this' | 'next' = 'next',
): WeekSlot[] {
  const parts = dayParts(schedule);
  if (!parts.length) {
    return [];
  }
  const closed = closedSet(schedule);
  const slots: WeekSlot[] = [];
  for (const day of weekDayKeys(now, which)) {
    if (!schedule.openDays.includes(jerusalemWeekday(`${day}T12:00:00Z`)) || closed.has(day)) {
      continue;
    }
    for (const { index, part, start, end } of parts) {
      const startsAt = jerusalemInstant(day, start);
      if (new Date(startsAt).getTime() <= now.getTime()) {
        continue;
      }
      slots.push({ id: `${day}-${index}`, startsAt, endsAt: jerusalemInstant(day, end), part });
    }
  }
  return slots;
}

function shortDate(value: string) {
  const [, month, day] = jerusalemDayKey(value).split('-');
  return `${Number(day)}.${Number(month)}`;
}

export function slotTalk(slot: WeekSlot) {
  const clockText = new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  });
  const day = `${DAY_NAMES[jerusalemWeekday(slot.startsAt)] ?? ''} ${shortDate(slot.startsAt)}`;
  const hours = `${clockText.format(new Date(slot.startsAt))}–${clockText.format(new Date(slot.endsAt))}`;
  return slot.part === 'משמרת' ? `${day} · ${hours}` : `${day} · ${slot.part} · ${hours}`;
}

export function resolveShiftPicks(text: string, all: WeekSlot[], open: WeekSlot[]) {
  const picked = new Set(parseShiftPicks(text.replace(/\d+/g, ' '), all));
  const folded = text.normalize('NFC');
  for (const match of folded.matchAll(/(?:^|\s)(\d{1,2})(?=\s|$)/g)) {
    const slot = open[Number(match[1]) - 1];
    if (slot) {
      picked.add(slot.id);
    }
  }
  return [...picked];
}

export function parseShiftPicks(text: string, slots: WeekSlot[]) {
  const folded = text.normalize('NFC').replace(/[״"]/g, '').trim();
  const numbers = [...folded.matchAll(/(?:^|\s)(\d{1,2})(?=\s|$)/g)].map((match) =>
    Number(match[1]),
  );
  const picked = new Set<string>();
  for (const number of numbers) {
    const slot = slots[number - 1];
    if (slot) {
      picked.add(slot.id);
    }
  }
  for (const slot of slots) {
    const day = DAY_NAMES[jerusalemWeekday(slot.startsAt)] ?? '';
    if (folded.includes(day) && (slot.part === 'משמרת' || folded.includes(slot.part))) {
      picked.add(slot.id);
    }
  }
  return [...picked];
}

export function claimRefusal(input: {
  schedule: ShopSchedule;
  startsAt: string;
  alreadyThatDay: boolean;
  shiftCount: number;
  weekendCount: number;
  filled: number;
}) {
  if (input.filled >= input.schedule.needed) {
    return 'המשמרת מלאה.';
  }
  if (input.alreadyThatDay) {
    return 'כבר יש משמרת באותו יום.';
  }
  const weekend = jerusalemWeekday(input.startsAt) >= 5;
  if (input.schedule.maxShifts > 0 && input.shiftCount >= input.schedule.maxShifts) {
    return 'הגעתם למקסימום משמרות השבוע.';
  }
  if (weekend && input.schedule.maxWeekend > 0 && input.weekendCount >= input.schedule.maxWeekend) {
    return 'הגעתם למקסימום משמרות סוף השבוע.';
  }
  return null;
}

function placesLeft(left: number, needed: number) {
  if (needed <= 1) {
    return '';
  }
  return left === 1 ? ' · נשאר מקום אחד' : ` · נשארו ${left} מקומות`;
}

export function weekAskText(input: {
  slots: { slot: WeekSlot; left: number }[];
  needed: number;
  name: string;
  shopName: string;
  link?: string;
}) {
  const open = input.slots.filter((row) => row.left > 0);
  const first = open[0]?.slot;
  const last = open.at(-1)?.slot;
  const week =
    first && last ? ` לשבוע ${shortDate(first.startsAt)}–${shortDate(last.startsAt)}` : '';
  if (!first) {
    return `היי ${input.name},\nהסידור של ${input.shopName} כבר מלא, ואין כרגע משמרות פנויות.`;
  }
  const firstDay = DAY_NAMES[jerusalemWeekday(first.startsAt)] ?? '';
  const example = first.part === 'משמרת' ? firstDay : `${firstDay} ${first.part}`;
  const lines = open.map(
    (row, index) => `${index + 1}. ${slotTalk(row.slot)}${placesLeft(row.left, input.needed)}`,
  );
  const parts = [`היי ${input.name},`, `הסידור של ${input.shopName}${week} פתוח לבחירה.`, ''];
  if (input.link) {
    parts.push(
      'לבחירת משמרות לחצו על הקישור:',
      input.link,
      '',
      'אפשר גם לענות כאן עם מספר המשמרת או היום, למשל 1 או ' + example + ':',
    );
  } else {
    parts.push(`עונים כאן עם מספר המשמרת או היום, למשל 1 או ${example}:`);
  }
  return [...parts, ...lines].join('\n');
}

export function slotLabel(slot: WeekSlot) {
  return shiftLabelFromStart(slot.startsAt);
}
