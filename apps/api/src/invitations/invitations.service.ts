import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { hashPassword, hashToken, randomToken } from '@itay-chai/auth';
import { loadEnv } from '@itay-chai/config';
import { ROLE_NAMES } from '@itay-chai/contracts';
import { prisma, withTenantDb } from '@itay-chai/database';

const INVITE_MS = 7 * 24 * 60 * 60 * 1000;
const INVITABLE_ROLES = new Set<string>([ROLE_NAMES.OWNER, ROLE_NAMES.STAKEHOLDER]);

export async function createInvitation(input: {
  tenantId: string;
  email: string;
  roleName: string;
  invitedByUserId: string;
}) {
  if (!INVITABLE_ROLES.has(input.roleName)) {
    throw new BadRequestException('Role cannot be invited');
  }
  const inviteToken = randomToken();
  await withTenantDb(input.tenantId, (tx) =>
    tx.invitation.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        roleName: input.roleName,
        tokenHash: hashToken(inviteToken),
        expiresAt: new Date(Date.now() + INVITE_MS),
        invitedByUserId: input.invitedByUserId,
      },
    }),
  );
  return loadEnv().NODE_ENV === 'production' ? { ok: true } : { ok: true, inviteToken };
}

export async function acceptInvitation(inviteToken: string, password: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(inviteToken) },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    throw new UnauthorizedException('Invalid invitation');
  }
  const role = await prisma.role.findFirst({
    where: { name: invitation.roleName, tenantId: null },
  });
  if (!role) {
    throw new BadRequestException('Unknown role');
  }

  const existing = await prisma.user.findFirst({ where: { email: invitation.email } });
  const user =
    existing ??
    (await prisma.user.create({
      data: {
        authSubject: `invite-${invitation.id}`,
        email: invitation.email,
        passwordHash: hashPassword(password),
      },
    }));
  if (existing && !existing.passwordHash) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hashPassword(password) },
    });
  }

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId_roleId: {
        tenantId: invitation.tenantId,
        userId: user.id,
        roleId: role.id,
      },
    },
    create: {
      tenantId: invitation.tenantId,
      userId: user.id,
      roleId: role.id,
      status: 'ACTIVE',
    },
    update: { status: 'ACTIVE' },
  });
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });
  return { ok: true, userId: user.id, tenantId: invitation.tenantId };
}
