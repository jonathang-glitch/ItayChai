import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitCoworker, requesterDaySet } from './shift-fit.js';

test('explains cover and swap for any shift from the same rules', () => {
  const thursday = new Date('2026-09-24T16:00:00+03:00');
  const sunday = new Date('2026-09-27T16:00:00+03:00');
  const yossi = {
    name: 'יוסי',
    shifts: [
      {
        id: 'fri',
        startsAt: new Date('2026-09-25T08:00:00+03:00'),
        endsAt: new Date('2026-09-25T14:00:00+03:00'),
      },
      {
        id: 'sat',
        startsAt: new Date('2026-09-26T16:00:00+03:00'),
        endsAt: new Date('2026-09-26T22:00:00+03:00'),
      },
    ],
  };
  const days = requesterDaySet([thursday, sunday]);
  const onThursday = fitCoworker(yossi, thursday, days);
  assert.equal(onThursday.canCover, true);
  assert.equal(onThursday.canSwap, true);
  assert.deepEqual(onThursday.swapShiftIds, ['fri', 'sat']);

  const onSunday = fitCoworker(yossi, sunday, days);
  assert.equal(onSunday.canCover, true);
  assert.equal(onSunday.canSwap, false);
  assert.equal(onSunday.block, 'no_swap_shift');

  const sameDay = fitCoworker(
    {
      name: 'יוסי',
      shifts: [{ id: 'thu', startsAt: thursday, endsAt: new Date('2026-09-24T22:00:00+03:00') }],
    },
    thursday,
    requesterDaySet([]),
  );
  assert.equal(sameDay.canCover, false);
  assert.equal(sameDay.block, 'busy_that_day');
});
