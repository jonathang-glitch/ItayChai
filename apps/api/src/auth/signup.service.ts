import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { hashPassword } from '@itay-chai/auth';
import { WHATSAPP_PROVIDER, ROLE_NAMES } from '@itay-chai/contracts';
import { prisma } from '@itay-chai/database';
import { login } from './auth.service';
import { assertWhatsAppFree, requireWhatsAppNumber } from './phone';

export async function signUp(input: {
  shopName: string;
  ownerName: string;
  email: string;
  password: string;
  whatsapp: string;
}) {
  const email = input.email.trim().toLowerCase();
  const phone = requireWhatsAppNumber(input.whatsapp);
  await assertWhatsAppFree(phone);
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    throw new ConflictException('Email already registered');
  }
  const ownerRole = await prisma.role.findFirst({
    where: { name: ROLE_NAMES.OWNER, tenantId: null },
  });
  if (!ownerRole) {
    throw new Error('Owner role is missing');
  }

  const userId = randomUUID();
  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.shopName.trim() },
    });
    const store = await tx.businessUnit.create({
      data: {
        tenantId: tenant.id,
        kind: 'STORE',
        name: input.shopName.trim(),
        timezone: 'Asia/Jerusalem',
      },
    });
    await tx.user.create({
      data: {
        id: userId,
        authSubject: `signup-${userId}`,
        email,
        name: input.ownerName.trim(),
        passwordHash: hashPassword(input.password),
      },
    });
    await tx.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId,
        roleId: ownerRole.id,
        businessUnitId: store.id,
        status: 'ACTIVE',
      },
    });
    await tx.stakeholderIdentity.create({
      data: {
        tenantId: tenant.id,
        userId,
        channel: WHATSAPP_PROVIDER,
        externalId: phone,
        verifiedAt: new Date(),
      },
    });
  });

  return login(email, input.password);
}
