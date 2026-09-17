import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geminiShiftConfigured, parseGeminiShiftDecision } from './gemini-shift-intent.js';

const shift = '00000000-0000-4000-8000-0000000000a2';

test('parses a Gemini swap decision and drops unknown shift ids', () => {
  const parsed = parseGeminiShiftDecision(
    `here\n{"action":"start_swap","shiftId":"${shift}","reply":"מחפשים החלפה."}\n`,
    [shift],
  );
  assert.deepEqual(parsed, { action: 'start_swap', shiftId: shift, reply: 'מחפשים החלפה.' });
  const bad = parseGeminiShiftDecision(
    JSON.stringify({ action: 'start_swap', shiftId: 'not-a-real-shift' }),
    [shift],
  );
  assert.equal(bad?.shiftId, undefined);
});

test('rejects unknown actions', () => {
  assert.equal(parseGeminiShiftDecision('{"action":"delete_store"}', [shift]), null);
});

test('does not use a dotenv Gemini key during tests', () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.NODE_ENV = 'test';
  assert.equal(geminiShiftConfigured(), false);
  if (previous) {
    process.env.GEMINI_API_KEY = previous;
  }
});
