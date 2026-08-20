import { SignJWT, jwtVerify } from 'jose';
import { loadEnv } from '@itay-chai/config';

export type AuthTokenClaims = {
  sub: string;
  email?: string;
  amr?: string[];
};

function secretKey() {
  return new TextEncoder().encode(loadEnv().SUPABASE_JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AuthTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey());
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Token missing sub');
  }
  return {
    sub: payload.sub,
    ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
    ...(Array.isArray(payload.amr)
      ? { amr: payload.amr.filter((item): item is string => typeof item === 'string') }
      : {}),
  };
}

export async function mintAccessToken(
  claims: AuthTokenClaims,
  expiresIn: string | number | Date = '15m',
): Promise<string> {
  return new SignJWT({
    ...(claims.email ? { email: claims.email } : {}),
    amr: claims.amr ?? ['pwd'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}
