import { UnauthorizedException } from '@nestjs/common';
import { hashToken, mintAccessToken, randomToken, verifyPassword } from '@itay-chai/auth';
import { prisma, type User } from '@itay-chai/database';

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

export async function login(email: string, password: string) {
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    throw new UnauthorizedException('Invalid credentials');
  }
  return issueTokens(user);
}

export async function refresh(refreshToken: string) {
  const session = await prisma.authSession.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new UnauthorizedException('Invalid refresh token');
  }
  await prisma.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
  return issueTokens(session.user);
}

export async function logout(refreshToken: string) {
  await prisma.authSession.updateMany({
    where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}

async function issueTokens(user: User) {
  const refreshToken = randomToken();
  await prisma.authSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_MS),
    },
  });
  const accessToken = await mintAccessToken({
    sub: user.authSubject,
    ...(user.email ? { email: user.email } : {}),
    amr: user.mfaEnabled ? ['pwd', 'mfa'] : ['pwd'],
  });
  return { accessToken, refreshToken, userId: user.id, expiresIn: 15 * 60 };
}
