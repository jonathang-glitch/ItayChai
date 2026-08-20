import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canTransition } from './state-machine.js';

test('allows the walking-skeleton path', () => {
  assert.equal(canTransition('DRAFT', 'INITIALIZING'), true);
  assert.equal(canTransition('INITIALIZING', 'PLANNING'), true);
  assert.equal(canTransition('PLANNING', 'COMPLETED'), true);
});

test('rejects skipped and reverse transitions', () => {
  assert.equal(canTransition('DRAFT', 'COMPLETED'), false);
  assert.equal(canTransition('COMPLETED', 'DRAFT'), false);
});
