import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '@itay-chai/config';

const LINK_DAYS = 21;

function sign(body: string) {
  return createHmac('sha256', `pick:${loadEnv().SUPABASE_JWT_SECRET}`)
    .update(body)
    .digest('base64url');
}

export function pickToken(tenantId: string, employeeId: string, now = Date.now()) {
  const body = Buffer.from(`${tenantId}.${employeeId}.${now + LINK_DAYS * 86_400_000}`).toString(
    'base64url',
  );
  return `${body}.${sign(body)}`;
}

export function pickUrl(tenantId: string, employeeId: string) {
  return `${loadEnv().PUBLIC_WEB_URL.replace(/\/$/, '')}/s/${pickToken(tenantId, employeeId)}`;
}

export function readPickToken(token: string, now = Date.now()) {
  const [body, signature] = token.split('.');
  if (!body || !signature) {
    return null;
  }
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  const [tenantId, employeeId, expires] = Buffer.from(body, 'base64url').toString().split('.');
  if (!tenantId || !employeeId || !(Number(expires) > now)) {
    return null;
  }
  return { tenantId, employeeId };
}
