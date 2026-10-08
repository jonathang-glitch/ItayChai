import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickRefusal } from './shop-week-picks.js';
import { buildWeekSlots, defaultSchedule } from './shop-week.js';

const now = new Date('2026-10-04T00:00:00.000Z');
const schedule = { ...defaultSchedule(), openDays: [0, 1, 2, 3, 4, 5, 6] };
const week = buildWeekSlots(schedule, now, 'this').map((slot) => ({ ...slot, takenByOthers: 0 }));
const morning = (day: string) => week.find((slot) => slot.id === `${day}-0`)?.id ?? '';
const evening = (day: string) => week.find((slot) => slot.id === `${day}-1`)?.id ?? '';

test('a free choice within the base rule is accepted', () => {
  assert.equal(
    pickRefusal({ schedule, slots: week, picks: [morning('2026-10-05'), evening('2026-10-06')] }),
    null,
  );
  assert.equal(pickRefusal({ schedule, slots: week, picks: [] }), null);
});

test('two shifts on one day and a full shift are refused', () => {
  assert.equal(
    pickRefusal({ schedule, slots: week, picks: [morning('2026-10-05'), evening('2026-10-05')] }),
    'אפשר משמרת אחת ביום.',
  );
  const full = week.map((slot) =>
    slot.id === morning('2026-10-06') ? { ...slot, takenByOthers: 1 } : slot,
  );
  assert.match(
    pickRefusal({ schedule, slots: full, picks: [morning('2026-10-06')] }) ?? '',
    /כבר מלאה/,
  );
  assert.equal(
    pickRefusal({
      schedule,
      slots: week,
      picks: [morning('2026-10-07')],
      busyDays: ['2026-10-07'],
    }),
    'אפשר משמרת אחת ביום.',
  );
});

test('owner minimums and maximums are enforced', () => {
  const strict = { ...schedule, minShifts: 2, maxShifts: 3, minWeekend: 1 };
  assert.equal(
    pickRefusal({ schedule: strict, slots: week, picks: [morning('2026-10-05')] }),
    'צריך לבחור לפחות 2 משמרות.',
  );
  assert.equal(
    pickRefusal({
      schedule: strict,
      slots: week,
      picks: [morning('2026-10-05'), morning('2026-10-06')],
    }),
    'צריך לבחור לפחות משמרת אחת בסוף השבוע.',
  );
  assert.equal(
    pickRefusal({
      schedule: strict,
      slots: week,
      picks: [morning('2026-10-05'), morning('2026-10-09')],
    }),
    null,
  );
  assert.equal(
    pickRefusal({
      schedule: strict,
      slots: week,
      picks: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'].map(morning),
    }),
    'אפשר עד 3 משמרות בשבוע.',
  );
});

test('a minimum the week cannot reach is lowered to what is open', () => {
  const strict = { ...schedule, minShifts: 3 };
  const twoDays = week.filter(
    (slot) => slot.id.startsWith('2026-10-05') || slot.id.startsWith('2026-10-06'),
  );
  assert.equal(
    pickRefusal({
      schedule: strict,
      slots: twoDays,
      picks: [morning('2026-10-05'), evening('2026-10-06')],
    }),
    null,
  );
});
