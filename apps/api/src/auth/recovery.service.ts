import { UnauthorizedException } from '@nestjs/common';
import { hashPassword, hashToken, randomToken } from '@itay-chai/auth';
import { loadEnv } from '@itay-chai/config';
import { prisma } from '@itay-chai/database';

const RESET_MS = 60 * 60 * 1000;

export async function recover(email: string) {
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    return { ok: true };
  }
  const resetToken = randomToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(resetToken),
      expiresAt: new Date(Date.now() + RESET_MS),
    },
  });
  return loadEnv().NODE_ENV === 'production' ? { ok: true } : { ok: true, resetToken };
}

export async function resetPassword(resetToken: string, password: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(resetToken) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new UnauthorizedException('Invalid reset token');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: hashPassword(password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.authSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return { ok: true };
}
