import { jerusalemDayKey, jerusalemWeekday } from '@itay-chai/contracts';
import type { ShopSchedule, WeekSlot } from './shop-week.js';

export type PickSlot = WeekSlot & { takenByOthers: number };

function isWeekend(slot: WeekSlot) {
  return jerusalemWeekday(slot.startsAt) >= 5;
}

function reachable(slots: PickSlot[], needed: number, busyDays: string[], weekendOnly: boolean) {
  const days = new Set<string>();
  for (const slot of slots) {
    const day = jerusalemDayKey(slot.startsAt);
    if (
      slot.takenByOthers < needed &&
      !busyDays.includes(day) &&
      (!weekendOnly || isWeekend(slot))
    ) {
      days.add(day);
    }
  }
  return days.size;
}

function shifts(count: number) {
  return count === 1 ? 'משמרת אחת' : `${count} משמרות`;
}

export function pickRules(schedule: ShopSchedule) {
  const rules = ['משמרת אחת ביום'];
  if (schedule.minShifts > 0) {
    rules.push(`לפחות ${shifts(schedule.minShifts)}`);
  }
  if (schedule.maxShifts > 0) {
    rules.push(`עד ${shifts(schedule.maxShifts)}`);
  }
  if (schedule.minWeekend > 0) {
    rules.push(`לפחות ${shifts(schedule.minWeekend)} בסוף השבוע`);
  }
  if (schedule.maxWeekend > 0) {
    rules.push(`עד ${shifts(schedule.maxWeekend)} בסוף השבוע`);
  }
  return rules;
}

type PickInput = {
  schedule: ShopSchedule;
  slots: PickSlot[];
  picks: string[];
  busyDays?: string[];
};

export function pickRefusal(input: PickInput) {
  const blocked = pickBlock(input);
  if (blocked) {
    return blocked;
  }
  const { schedule, slots } = input;
  const busyDays = input.busyDays ?? [];
  const chosen = slots.filter((slot) => input.picks.includes(slot.id));
  const minShifts = Math.min(
    schedule.minShifts,
    reachable(slots, schedule.needed, busyDays, false),
  );
  if (chosen.length < minShifts) {
    return `צריך לבחור לפחות ${shifts(minShifts)}.`;
  }
  const minWeekend = Math.min(
    schedule.minWeekend,
    reachable(slots, schedule.needed, busyDays, true),
  );
  if (chosen.filter(isWeekend).length < minWeekend) {
    return `צריך לבחור לפחות ${shifts(minWeekend)} בסוף השבוע.`;
  }
  return null;
}

export function pickBlock(input: PickInput) {
  const { schedule, slots, picks } = input;
  const busyDays = input.busyDays ?? [];
  const chosen: PickSlot[] = [];
  for (const id of new Set(picks)) {
    const slot = slots.find((row) => row.id === id);
    if (!slot) {
      return 'אחת המשמרות כבר לא בסידור. רעננו את הדף.';
    }
    if (slot.takenByOthers >= schedule.needed) {
      return `ה${slot.part} ב${jerusalemDayKey(slot.startsAt).slice(8)}/${jerusalemDayKey(slot.startsAt).slice(5, 7)} כבר מלאה.`;
    }
    chosen.push(slot);
  }
  const days = chosen.map((slot) => jerusalemDayKey(slot.startsAt));
  if (new Set(days).size !== days.length || days.some((day) => busyDays.includes(day))) {
    return 'אפשר משמרת אחת ביום.';
  }
  const weekend = chosen.filter(isWeekend).length;
  if (schedule.maxShifts > 0 && chosen.length > schedule.maxShifts) {
    return `אפשר עד ${shifts(schedule.maxShifts)} בשבוע.`;
  }
  if (schedule.maxWeekend > 0 && weekend > schedule.maxWeekend) {
    return `אפשר עד ${shifts(schedule.maxWeekend)} בסוף השבוע.`;
  }
  return null;
}
