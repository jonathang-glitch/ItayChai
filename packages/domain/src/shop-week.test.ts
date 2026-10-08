import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildWeekSlots,
  claimRefusal,
  dayParts,
  defaultSchedule,
  parseShiftPicks,
  readSchedule,
} from './shop-week.js';

const now = new Date('2026-10-04T00:00:00.000Z');

test('a week of two parts skips a holiday and a closed Sunday', () => {
  const schedule = readSchedule({
    ...defaultSchedule(),
    openDays: [0, 1, 2, 3, 4],
    closedDates: ['2026-10-04'],
    skippedHolidays: [],
  });
  const slots = buildWeekSlots(schedule, now, 'this');
  assert.equal(
    slots.some((slot) => slot.id.startsWith('2026-10-04')),
    false,
  );
  assert.equal(slots.filter((slot) => slot.id.startsWith('2026-10-05')).length, 2);
  assert.equal(slots[0]?.part, 'בוקר');
  assert.equal(slots[1]?.part, 'ערב');
});

test('owner hours for each part replace the equal split, and bad hours fall back to it', () => {
  const custom = readSchedule({ ...defaultSchedule(), parts: 3, splits: ['11:00', '17:30'] });
  assert.deepEqual(
    dayParts(custom).map(({ start, end }) => `${start}-${end}`),
    ['08:00-11:00', '11:00-17:30', '17:30-22:00'],
  );
  const slots = buildWeekSlots(custom, now, 'this').filter((slot) =>
    slot.id.startsWith('2026-10-05'),
  );
  assert.equal(slots[1]?.startsAt, '2026-10-05T08:00:00.000Z');
  const backwards = readSchedule({ ...defaultSchedule(), splits: ['23:00'] });
  assert.deepEqual(backwards.splits, []);
  assert.deepEqual(
    dayParts({ ...backwards, parts: 3 }).map(({ start }) => start),
    ['08:00', '12:30', '17:00'],
  );
  assert.deepEqual(
    dayParts(backwards).map(({ start, end }) => `${start}-${end}`),
    ['08:00-15:00', '15:00-22:00'],
  );
});

test('pesach is closed unless the shop skips that holiday', () => {
  const schedule = readSchedule({ ...defaultSchedule(), openDays: [0, 1, 2, 3, 4, 5, 6] });
  const pesachWeek = buildWeekSlots(schedule, new Date('2027-04-18T00:00:00.000Z'), 'this');
  assert.equal(
    pesachWeek.some((slot) => slot.id.startsWith('2027-04-22')),
    false,
  );
  const open = readSchedule({ ...schedule, skippedHolidays: ['2027-04-22'] });
  const kept = buildWeekSlots(open, new Date('2027-04-18T00:00:00.000Z'), 'this');
  assert.equal(
    kept.some((slot) => slot.id.startsWith('2027-04-22')),
    true,
  );
});

test('a reply can name a number or a day and part', () => {
  const slots = buildWeekSlots(defaultSchedule(), now, 'this');
  assert.deepEqual(parseShiftPicks('2', slots), [slots[1]?.id]);
  const morning = slots.find((slot) => slot.part === 'בוקר' && slot.id.startsWith('2026-10-05'));
  assert.ok(morning);
  assert.equal(parseShiftPicks('שני בוקר', slots).includes(morning.id), true);
});

test('max shifts and a full slot are refused', () => {
  const schedule = { ...defaultSchedule(), maxShifts: 5 };
  assert.equal(
    claimRefusal({
      schedule,
      startsAt: '2026-10-05T05:00:00.000Z',
      alreadyThatDay: false,
      shiftCount: 5,
      weekendCount: 0,
      filled: 0,
    }),
    'הגעתם למקסימום משמרות השבוע.',
  );
  assert.equal(
    claimRefusal({
      schedule: { ...schedule, needed: 1 },
      startsAt: '2026-10-05T05:00:00.000Z',
      alreadyThatDay: false,
      shiftCount: 0,
      weekendCount: 0,
      filled: 1,
    }),
    'המשמרת מלאה.',
  );
});
