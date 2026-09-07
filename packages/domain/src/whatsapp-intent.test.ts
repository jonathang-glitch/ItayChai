import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyWhatsAppText,
  inferRequestKind,
  normalizeWhatsAppId,
  parseWhatsAppButton,
} from './whatsapp-intent.js';

test('normalizes Israeli numbers to E.164', () => {
  assert.equal(normalizeWhatsAppId('972500000002'), '+972500000002');
  assert.equal(normalizeWhatsAppId('0500000002'), '+972500000002');
  assert.equal(normalizeWhatsAppId('+972500000002'), '+972500000002');
});

test('classifies Hebrew offer and match replies', () => {
  assert.equal(classifyWhatsAppText('כן'), 'yes');
  assert.equal(classifyWhatsAppText('לא'), 'no');
  assert.equal(classifyWhatsAppText('כיסוי'), 'cover');
  assert.equal(classifyWhatsAppText('החלפה'), 'swap');
  assert.equal(classifyWhatsAppText('מאשר החלפה'), 'accept');
  assert.equal(classifyWhatsAppText('בטל'), 'cancel');
  assert.equal(classifyWhatsAppText('צריך מחליף בשישי'), 'new');
  assert.equal(inferRequestKind('new'), 'COVER');
  assert.equal(inferRequestKind('swap'), 'SWAP');
});

test('parses offer and match button ids', () => {
  const offerId = '00000000-0000-4000-8000-000000000111';
  const shiftId = '00000000-0000-4000-8000-000000000112';
  const sessionId = '00000000-0000-4000-8000-000000000113';
  assert.deepEqual(parseWhatsAppButton(`offer:${offerId}:cover`), {
    kind: 'offer',
    offerId,
    action: 'cover',
  });
  assert.deepEqual(parseWhatsAppButton(`offer:${offerId}:swap:${shiftId}`), {
    kind: 'offer',
    offerId,
    action: 'swap',
    proposedShiftId: shiftId,
  });
  assert.deepEqual(parseWhatsAppButton(`match:${sessionId}:accept`), {
    kind: 'match',
    sessionId,
    action: 'accept',
  });
  assert.equal(parseWhatsAppButton('garbage'), null);
});
