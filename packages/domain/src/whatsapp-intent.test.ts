import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyMatchReply,
  classifyWhatsAppText,
  inferRequestKind,
  isSandboxJoin,
  matchShiftFromText,
  normalizeWhatsAppId,
  parseWhatsAppButton,
  shouldClassifyWithGemini,
} from './whatsapp-intent.js';

test('normalizes Israeli numbers to E.164', () => {
  assert.equal(normalizeWhatsAppId('972500000002'), '+972500000002');
  assert.equal(normalizeWhatsAppId('0500000002'), '+972500000002');
  assert.equal(normalizeWhatsAppId('+972500000002'), '+972500000002');
});

test('classifies Hebrew offer and match replies', () => {
  assert.equal(classifyWhatsAppText('כן'), 'yes');
  assert.equal(classifyWhatsAppText('לא'), 'no');
  assert.equal(classifyWhatsAppText('לא רוצה'), 'no');
  assert.equal(classifyWhatsAppText('אין לי'), 'no');
  assert.equal(classifyWhatsAppText('לא יכולה'), 'no');
  assert.equal(classifyWhatsAppText('לא רוצה להחליף'), 'no');
  assert.equal(classifyWhatsAppText('לא מעוניינת'), 'no');
  assert.equal(classifyWhatsAppText('עסוקה'), 'no');
  assert.equal(classifyWhatsAppText('כיסוי'), 'cover');
  assert.equal(classifyWhatsAppText('החלפה'), 'swap');
  assert.equal(classifyWhatsAppText('אני רוצה להחליף'), 'swap');
  assert.equal(classifyWhatsAppText('בטח'), 'yes');
  assert.equal(classifyWhatsAppText('אשמח'), 'yes');
  assert.equal(classifyWhatsAppText('סבבה'), 'yes');
  assert.equal(classifyWhatsAppText('יאללה'), 'yes');
  assert.equal(classifyWhatsAppText('לא אכפת לי'), 'either');
  assert.equal(classifyWhatsAppText('לא בטוחה'), 'unknown');
  assert.equal(classifyWhatsAppText('מאשר החלפה'), 'accept');
  assert.equal(classifyWhatsAppText('מאשרת'), 'accept');
  assert.equal(classifyWhatsAppText('כן מאשרת'), 'accept');
  assert.equal(classifyWhatsAppText('אני מאשרת'), 'accept');
  assert.equal(classifyWhatsAppText('בסדר מאשרת'), 'accept');
  assert.equal(classifyWhatsAppText('לא מאשרת'), 'decline_match');
  assert.equal(classifyWhatsAppText('מסרבת'), 'decline_match');
  assert.equal(classifyWhatsAppText('עדיף שלא'), 'no');
  assert.equal(classifyWhatsAppText('לא כרגע'), 'no');
  assert.equal(classifyWhatsAppText('מוותרת'), 'no');
  assert.equal(classifyWhatsAppText('תודה לא'), 'no');
  assert.equal(classifyWhatsAppText('בטל'), 'cancel');
  assert.equal(classifyWhatsAppText('שלום'), 'hello');
  assert.equal(classifyWhatsAppText('מה נשמע'), 'hello');
  assert.equal(classifyWhatsAppText('נשמע מה'), 'hello');
  assert.equal(classifyWhatsAppText('האם אני יכול להחליך עם יוסי?'), 'swap');
  assert.equal(classifyWhatsAppText('אני רוצה לחליך את המשמרת שיש לי ביום חמישי'), 'swap');
  assert.equal(classifyWhatsAppText('פחות מתאים'), 'decline_match');
  assert.equal(classifyWhatsAppText('אין משהו אחר שאפשר לעשות?'), 'help');
  assert.equal(classifyMatchReply('אני לא רוצה להחליף עם משהו אחר יוסי הוא טוב'), 'accept');
  assert.equal(classifyMatchReply('אני רוצה להחליף עם מישהו אחר שהוא לא יוסי'), 'decline');
  assert.equal(classifyMatchReply('מאשר'), 'accept');
  assert.equal(classifyMatchReply('לא'), 'decline');
  assert.equal(classifyMatchReply('לא בא לי סבבה?'), 'unknown');
  assert.equal(isSandboxJoin('join solar-well'), true);
  assert.equal(shouldClassifyWithGemini('אני לא מרגישה טוב נראלי אני לא אוכל להגיע למשמרת'), true);
  assert.equal(shouldClassifyWithGemini('מאשר'), false);
  assert.equal(classifyWhatsAppText('צריך מחליף בשישי'), 'new');
  assert.equal(classifyWhatsAppText('אני מרגיש טוב נראה לי לא יכול להגיע למשמרת'), 'new');
  assert.equal(classifyWhatsAppText('מה המשמרות שלי השבוע'), 'roster');
  assert.equal(classifyWhatsAppText('איזה משמרות יש לי'), 'roster');
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

test('matches a named shift from free text', () => {
  const friday = {
    id: '00000000-0000-4000-8000-0000000000a2',
    label: 'שישי בערב',
    startsAt: new Date('2026-09-11T16:00:00+03:00'),
  };
  const sunday = {
    id: '00000000-0000-4000-8000-0000000000a3',
    label: 'ראשון בבוקר',
    startsAt: new Date('2026-09-13T08:00:00+03:00'),
  };
  assert.equal(matchShiftFromText('שישי בערב', [friday, sunday]), friday.id);
  assert.equal(matchShiftFromText('אפשר ראשון', [friday, sunday]), sunday.id);
  assert.equal(matchShiftFromText('רק שישי', [friday, sunday]), friday.id);
  assert.equal(matchShiftFromText('לא שישי, ראשון', [friday, sunday]), sunday.id);
  assert.equal(matchShiftFromText('לא רוצה', [friday, sunday]), undefined);
  const tuesday = {
    id: '00000000-0000-4000-8000-0000000000a4',
    label: 'שלישי בערב',
    startsAt: new Date('2026-09-15T16:00:00+03:00'),
  };
  assert.equal(matchShiftFromText('אני רוצה להחליף ביום שישי', [friday, sunday, tuesday]), friday.id);
  assert.equal(matchShiftFromText('אני רוצה להחליף ביום שלישי', [friday, sunday, tuesday]), tuesday.id);
  assert.equal(matchShiftFromText('שישי', [friday, tuesday]), friday.id);
  assert.equal(matchShiftFromText('שלישי', [friday, tuesday]), tuesday.id);
  assert.equal(matchShiftFromText('צריך מחליף בשישי', [friday, tuesday]), friday.id);
  assert.equal(matchShiftFromText('צריך מחליף בשלישי', [friday, tuesday]), tuesday.id);
});
