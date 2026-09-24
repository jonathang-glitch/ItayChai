import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestFlags } from './request-kind.js';

test('a request is two flags', () => {
  assert.deepEqual(requestFlags('COVER'), { allowCover: true, allowSwap: false });
  assert.deepEqual(requestFlags('SWAP'), { allowCover: false, allowSwap: true });
  assert.deepEqual(requestFlags('EITHER'), { allowCover: true, allowSwap: true });
});
