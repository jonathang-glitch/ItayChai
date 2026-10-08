import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deskAskFromLastBot, resolveDeskAction } from './desk-policy.js';

test('a yes commits a swap only when that swap is the open question', () => {
  assert.equal(
    deskAskFromLastBot('יוסי מוכן להחליף. אחרי האישור המשמרת תהיה שבת בערב.\nלאשר את ההחלפה?'),
    'confirm_swap',
  );
  assert.equal(
    resolveDeskAction({ action: 'accept_match', ask: 'confirm_swap', shiftPick: false }),
    'accept_match',
  );
  assert.equal(
    resolveDeskAction({ action: 'accept_match', ask: 'none', shiftPick: false }),
    'clarify',
  );
  assert.equal(
    resolveDeskAction({ action: 'accept_match', ask: 'pick_cover', shiftPick: false }),
    'clarify',
  );
});

test('naming a shift keeps the kind that was just asked', () => {
  assert.equal(
    deskAskFromLastBot('באיזו משמרת? אפשר לכתוב אחת מהרשימה:\nחמישי בערב'),
    'pick_either',
  );
  assert.equal(
    resolveDeskAction({ action: 'start_swap', ask: 'pick_cover', shiftPick: true }),
    'start_cover',
  );
  assert.equal(
    resolveDeskAction({ action: 'start_cover', ask: 'pick_swap', shiftPick: true }),
    'start_swap',
  );
  assert.equal(
    resolveDeskAction({ action: 'start_swap', ask: 'none', shiftPick: true }),
    'start_swap',
  );
});

test('an unspecified request is cover or swap', () => {
  assert.equal(
    resolveDeskAction({ action: 'start_cover', ask: 'none', shiftPick: false, unspecified: true }),
    'start_either',
  );
  assert.equal(
    resolveDeskAction({ action: 'start_swap', ask: 'pick_either', shiftPick: true }),
    'start_either',
  );
});

test('a cover request starts a cover even when the model only talks', () => {
  assert.equal(
    resolveDeskAction({
      action: 'clarify',
      ask: 'confirm_swap',
      shiftPick: false,
      arrangement: 'cover',
    }),
    'start_cover',
  );
  assert.equal(
    resolveDeskAction({
      action: 'accept_match',
      ask: 'confirm_swap',
      shiftPick: false,
      arrangement: 'cover',
    }),
    'start_cover',
  );
});
