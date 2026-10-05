import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { TwilioWhatsAppAdapter, verifyTwilioSignature } from './whatsapp-twilio.js';

const url = 'https://shop.example/api/v1/webhooks/whatsapp';
const params = { Body: 'כן', From: 'whatsapp:+972501111111', MessageSid: 'SM1' };
const token = 'test-token';

function sign(value: Record<string, string>) {
  const payload = Object.keys(value)
    .sort()
    .reduce((base, key) => `${base}${key}${value[key]}`, url);
  return createHmac('sha1', token).update(payload, 'utf8').digest('base64');
}

test('Twilio signature accepts the signed params and rejects a bad one', () => {
  const signature = sign(params);
  assert.equal(verifyTwilioSignature({ url, params, signature, authToken: token }), true);
  assert.equal(verifyTwilioSignature({ url, params, signature: 'nope', authToken: token }), false);
  assert.equal(verifyTwilioSignature({ url, params, signature, authToken: undefined }), false);
});

test('Twilio adapter checks the signature header against the auth token', () => {
  const previous = process.env.TWILIO_AUTH_TOKEN;
  process.env.TWILIO_AUTH_TOKEN = token;
  try {
    const adapter = new TwilioWhatsAppAdapter();
    const signature = sign(params);
    assert.equal(
      adapter.verifyWebhook({ 'x-twilio-signature': signature, 'x-request-url': url }, JSON.stringify(params)),
      true,
    );
    assert.equal(adapter.verifyWebhook({ 'x-request-url': url }, JSON.stringify(params)), false);
  } finally {
    if (previous === undefined) {
      delete process.env.TWILIO_AUTH_TOKEN;
    } else {
      process.env.TWILIO_AUTH_TOKEN = previous;
    }
  }
});
