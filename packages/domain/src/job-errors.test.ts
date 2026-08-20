import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyJobError, isRetryable, PermanentJobError } from './job-errors.js';

test('permanent validation errors are not retried', () => {
  const classified = classifyJobError(new PermanentJobError('bad payload'));
  assert.equal(classified.errorClass, 'VALIDATION');
  assert.equal(isRetryable(classified.errorClass), false);
});

test('unknown errors stay retryable until they exhaust attempts', () => {
  const classified = classifyJobError(new Error('redis timeout'));
  assert.equal(classified.errorClass, 'UNKNOWN');
  assert.equal(isRetryable(classified.errorClass), true);
});
