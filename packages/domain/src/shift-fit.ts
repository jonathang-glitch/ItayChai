import { jerusalemDayKey, jerusalemWeekKey } from '@itay-chai/contracts';

export type RosterShift = {
  id: string;
  startsAt: Date;
  endsAt: Date;
};

export type FitBlock = 'busy_that_day' | 'no_swap_shift';

export type CoworkerFit = {
  name: string;
  canCover: boolean;
  canSwap: boolean;
  swapShiftIds: string[];
  block: FitBlock | null;
};

function weeksAround(startsAt: Date) {
  return new Set([
    jerusalemWeekKey(startsAt),
    jerusalemWeekKey(new Date(startsAt.getTime() + 7 * 86_400_000)),
  ]);
}

export function requesterDaySet(starts: Date[]) {
  return new Set(starts.map((value) => jerusalemDayKey(value)));
}

export function swapChoicesFor<T extends RosterShift>(
  coworkerShifts: T[],
  days: Set<string>,
  wantedAt?: Date,
) {
  return coworkerShifts
    .filter((shift) => !days.has(jerusalemDayKey(shift.startsAt)))
    .filter((shift) => !wantedAt || weeksAround(wantedAt).has(jerusalemWeekKey(shift.startsAt)))
    .filter((shift) => !wantedAt || shift.endsAt.getTime() > wantedAt.getTime())
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

export function fitCoworker(
  coworker: { name: string; shifts: RosterShift[] },
  wantedAt: Date,
  days: Set<string>,
): CoworkerFit {
  const busy = coworker.shifts.some((shift) => jerusalemDayKey(shift.startsAt) === jerusalemDayKey(wantedAt));
  if (busy) {
    return { name: coworker.name, canCover: false, canSwap: false, swapShiftIds: [], block: 'busy_that_day' };
  }
  const swapShiftIds = swapChoicesFor(coworker.shifts, days, wantedAt).map((shift) => shift.id);
  return {
    name: coworker.name,
    canCover: true,
    canSwap: swapShiftIds.length > 0,
    swapShiftIds,
    block: swapShiftIds.length ? null : 'no_swap_shift',
  };
}
