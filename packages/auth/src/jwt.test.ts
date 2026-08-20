import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mintAccessToken, verifyAccessToken } from './jwt.js';

test('rejects an expired access token', async () => {
  const token = await mintAccessToken({ sub: 'auth-owner-a', email: 'owner-a@example.com' }, new Date(0));
  await assert.rejects(() => verifyAccessToken(token), /exp|timestamp|expired/i);
});
