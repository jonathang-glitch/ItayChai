import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  answerDeskQuestion,
  classifyMatchReply,
  classifyWhatsAppText,
  inferRequestKind,
  isDeskQuestion,
  isSandboxJoin,
  matchShiftFromText,
  normalizeWhatsAppId,
  parseWhatsAppButton,
  requestedArrangement,
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
  assert.equal(
    shouldClassifyWithGemini('אני רוצה שמישהו יקח במקומי את אחת מהמשמרות שלי', 'roster'),
    true,
  );
  assert.equal(shouldClassifyWithGemini('מאשר'), true);
  assert.equal(shouldClassifyWithGemini('משמרות'), true);
  assert.equal(classifyWhatsAppText('צריך מחליף בשישי'), 'new');
  assert.equal(classifyWhatsAppText('אני מרגיש טוב נראה לי לא יכול להגיע למשמרת'), 'new');
  assert.equal(classifyWhatsAppText('אני רוצה שמישהו יחליף אותי באחת מהמשמרות'), 'new');
  assert.equal(classifyWhatsAppText('אני רוצה שמישהו יקח במקומי את אחת מהמשמרות שלי'), 'new');
  assert.equal(requestedArrangement('אני לא יכול להחליף איתו הוא יכול לכסות עלי?'), 'cover');
  assert.equal(requestedArrangement('למה מה המשמרות של יוסי?'), null);
  assert.equal(isDeskQuestion('הוא רוצה להחליף איתי תאריך אחר או סתם שאני אחפה עליו?'), true);
  assert.equal(isDeskQuestion('מה נשמע'), false);
  assert.equal(isDeskQuestion('כיסוי'), false);
  assert.equal(
    answerDeskQuestion('הוא רוצה להחליף איתי תאריך אחר או סתם שאני אחפה עליו?', {
      pending: { name: 'יוסי', label: 'שישי בבוקר (25 בספט׳)', allowCover: true, allowSwap: false },
    }),
    'יוסי ביקש כיסוי לשישי בבוקר (25 בספט׳). לא החלפה.',
  );
  const mine = ['חמישי בערב (8 באוק׳)', 'שישי בבוקר (9 באוק׳)', 'ראשון בערב (11 באוק׳)'];
  assert.equal(answerDeskQuestion('יש לי משמרת בחמישי?', { mine }), 'כן. חמישי בערב (8 באוק׳)');
  assert.equal(
    answerDeskQuestion('יש לי משמרת בחמישי בבוקר?', { mine }),
    'לא. אין לך משמרת בחמישי בבוקר.',
  );
  assert.equal(answerDeskQuestion('יש לי משמרת בשבת?', { mine }), 'לא. אין לך משמרת בשבת.');
  const today = new Date('2026-10-08T12:00:00Z');
  const stamp = new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(today);
  const withToday = [`חמישי בערב (${stamp})`, 'חמישי בבוקר (15 באוק׳)'];
  assert.equal(
    answerDeskQuestion('האם אני עושה היום משמרת בוקר או ערב?', { mine: withToday }, today),
    `היום יש לך משמרת ערב: חמישי בערב (${stamp})`,
  );
  assert.equal(
    answerDeskQuestion('יש לי משמרת מחר?', { mine: withToday }, new Date('2026-10-07T12:00:00Z')),
    `מחר יש לך משמרת ערב: חמישי בערב (${stamp})`,
  );
  const now = new Date('2026-10-08T12:00:00Z');
  const dated = [
    { label: `חמישי בערב (${stamp})`, startsAt: '2026-10-08T13:00:00.000Z' },
    { label: 'ראשון בערב (11 באוק׳)', startsAt: '2026-10-11T13:00:00.000Z' },
    { label: 'חמישי בבוקר (15 באוק׳)', startsAt: '2026-10-15T05:00:00.000Z' },
  ];
  assert.equal(
    answerDeskQuestion('מה המשמרות שלי השבוע?', { mine: dated }, now),
    `השבוע יש לך משמרת ערב: חמישי בערב (${stamp})`,
  );
  assert.equal(
    answerDeskQuestion('מה המשמרות שלי שבוע הבא?', { mine: dated }, now),
    'בשבוע הבא יש לך:\nראשון בערב (11 באוק׳)\nחמישי בבוקר (15 באוק׳)',
  );
  assert.equal(
    answerDeskQuestion('יש לי משמרת בחמישי שבוע הבא?', { mine: dated }, now),
    'בשבוע הבא חמישי יש לך משמרת בוקר: חמישי בבוקר (15 באוק׳)',
  );
  assert.equal(
    answerDeskQuestion(
      'מה המשמרות של יוסי מחר?',
      { team: [{ name: 'יוסי', shifts: dated }] },
      new Date('2026-10-07T12:00:00Z'),
    ),
    `מחר יש ליוסי משמרת ערב: חמישי בערב (${stamp})`,
  );
  assert.equal(requestedArrangement('אני רוצה שמישהו יכסה לי את המשמרת מחר'), 'cover');
  assert.equal(classifyWhatsAppText('משמרות'), 'roster');
  assert.equal(classifyWhatsAppText('מה המשמרות שלי השבוע'), 'roster');
  assert.equal(classifyWhatsAppText('איזה משמרות יש לי'), 'roster');
  assert.equal(inferRequestKind('new'), 'EITHER');
  assert.equal(inferRequestKind('cover'), 'COVER');
  assert.equal(inferRequestKind('swap'), 'SWAP');
  assert.equal(inferRequestKind('either'), 'EITHER');
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
  assert.equal(
    matchShiftFromText('אני רוצה להחליף ביום שישי', [friday, sunday, tuesday]),
    friday.id,
  );
  assert.equal(
    matchShiftFromText('אני רוצה להחליף ביום שלישי', [friday, sunday, tuesday]),
    tuesday.id,
  );
  assert.equal(matchShiftFromText('שישי', [friday, tuesday]), friday.id);
  assert.equal(matchShiftFromText('שלישי', [friday, tuesday]), tuesday.id);
  assert.equal(matchShiftFromText('צריך מחליף בשישי', [friday, tuesday]), friday.id);
  assert.equal(matchShiftFromText('צריך מחליף בשלישי', [friday, tuesday]), tuesday.id);
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' })
    .format(new Date())
    .split('-')
    .map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
  const iso = next.toISOString().slice(0, 10);
  const tomorrow = {
    id: '00000000-0000-4000-8000-0000000000a5',
    label: 'מחר',
    startsAt: new Date(`${iso}T08:00:00+03:00`),
  };
  assert.equal(
    matchShiftFromText('אני רוצה שמישהו יכסה לי את המשמרת מחר', [tomorrow, friday]),
    tomorrow.id,
  );
});
