import { hashPassword } from '@itay-chai/auth';
import {
  DEV_TENANT_ID,
  PERMISSIONS,
  ROLE_NAMES,
  SECOND_TENANT_ID,
} from '@itay-chai/contracts';
import { prisma } from './index.js';
import { seedRoster } from './seed-roster.js';

export const SEED_PASSWORD = 'dev-password';

export const SEED_USERS = {
  ownerA: {
    id: '00000000-0000-4000-8000-000000000011',
    authSubject: 'auth-owner-a',
    email: 'owner-a@example.com',
    name: 'נועה',
  },
  ownerB: {
    id: '00000000-0000-4000-8000-000000000012',
    authSubject: 'auth-owner-b',
    email: 'owner-b@example.com',
    name: 'דנה',
  },
  ops: {
    id: '00000000-0000-4000-8000-000000000013',
    authSubject: 'auth-ops',
    email: 'ops@example.com',
    name: 'תפעול',
  },
  stakeholderA: {
    id: '00000000-0000-4000-8000-000000000014',
    authSubject: 'auth-stakeholder-a',
    email: 'stakeholder-a@example.com',
    name: 'שותף',
  },
  customerA: {
    id: '00000000-0000-4000-8000-000000000015',
    authSubject: 'auth-customer-a',
    email: 'customer-a@example.com',
    name: 'אורי',
  },
};

const TEL_AVIV_STORE_ID = '00000000-0000-4000-8000-000000000021';

export async function seedIdentity() {
  await prisma.tenant.upsert({
    where: { id: DEV_TENANT_ID },
    create: { id: DEV_TENANT_ID, name: 'חנות תל אביב', status: 'active' },
    update: { name: 'חנות תל אביב', status: 'active' },
  });
  await prisma.tenant.upsert({
    where: { id: SECOND_TENANT_ID },
    create: { id: SECOND_TENANT_ID, name: 'Second Tenant', status: 'active' },
    update: { name: 'Second Tenant', status: 'active' },
  });

  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { key: description },
      create: { key: description, description: key },
      update: { description: key },
    });
  }

  const ownerRole = await upsertRole(ROLE_NAMES.OWNER, [
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.SESSION_WRITE,
    PERMISSIONS.TENANT_MANAGE,
  ]);
  const stakeholderRole = await upsertRole(ROLE_NAMES.STAKEHOLDER, [PERMISSIONS.SESSION_READ]);
  const customerRole = await upsertRole(ROLE_NAMES.CUSTOMER, [PERMISSIONS.CUSTOMER_WRITE]);
  const opsRole = await upsertRole(ROLE_NAMES.OPS_ADMIN, [
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.SESSION_WRITE,
    PERMISSIONS.BREAK_GLASS,
    PERMISSIONS.DLQ_REPLAY,
  ]);

  await prisma.businessUnit.upsert({
    where: { id: TEL_AVIV_STORE_ID },
    create: {
      id: TEL_AVIV_STORE_ID,
      tenantId: DEV_TENANT_ID,
      kind: 'STORE',
      name: 'חנות תל אביב',
    },
    update: { name: 'חנות תל אביב' },
  });
  await prisma.businessUnit.upsert({
    where: { id: '00000000-0000-4000-8000-000000000022' },
    create: {
      id: '00000000-0000-4000-8000-000000000022',
      tenantId: SECOND_TENANT_ID,
      kind: 'PROPERTY',
      name: 'Haifa Property',
    },
    update: { name: 'Haifa Property' },
  });

  await upsertUser(SEED_USERS.ownerA, false);
  await upsertUser(SEED_USERS.ownerB, false);
  await upsertUser(SEED_USERS.ops, true);
  await upsertUser(SEED_USERS.stakeholderA, false);
  await upsertUser(SEED_USERS.customerA, false);

  await upsertMembership(DEV_TENANT_ID, SEED_USERS.ownerA.id, ownerRole.id, TEL_AVIV_STORE_ID);
  await upsertMembership(SECOND_TENANT_ID, SEED_USERS.ownerB.id, ownerRole.id);
  await upsertMembership(DEV_TENANT_ID, SEED_USERS.ops.id, opsRole.id);
  await upsertMembership(DEV_TENANT_ID, SEED_USERS.stakeholderA.id, stakeholderRole.id);
  await upsertMembership(DEV_TENANT_ID, SEED_USERS.customerA.id, customerRole.id, TEL_AVIV_STORE_ID);

  await seedRoster(prisma);

  await prisma.stakeholderIdentity.upsert({
    where: {
      tenantId_channel_externalId: {
        tenantId: DEV_TENANT_ID,
        channel: 'web',
        externalId: SEED_USERS.customerA.id,
      },
    },
    create: {
      tenantId: DEV_TENANT_ID,
      userId: SEED_USERS.customerA.id,
      channel: 'web',
      externalId: SEED_USERS.customerA.id,
      verifiedAt: new Date(),
    },
    update: { userId: SEED_USERS.customerA.id, verifiedAt: new Date() },
  });
}

export async function resetClientInbox() {
  await prisma.shiftSwapRequest.deleteMany();
  await prisma.dlqReplay.deleteMany();
  await prisma.dlqItem.deleteMany();
  await prisma.jobAttempt.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.inboxMessage.deleteMany();
  await prisma.message.deleteMany();
  await prisma.sessionTransition.deleteMany();
  await prisma.outboxMessage.deleteMany();
  await prisma.domainEvent.deleteMany();
  await prisma.auditEntry.deleteMany();
  await prisma.webhookReceipt.deleteMany();
  await prisma.agentSession.deleteMany();
}

async function upsertRole(name: string, permissionKeys: string[]) {
  const existing = await prisma.role.findFirst({ where: { name, tenantId: null } });
  const role =
    existing ??
    (await prisma.role.create({
      data: { name, tenantId: null },
    }));
  for (const key of permissionKeys) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      create: { roleId: role.id, permissionId: permission.id },
      update: {},
    });
  }
  return role;
}

async function upsertUser(
  user: { id: string; authSubject: string; email: string; name: string },
  isOpsAdmin: boolean,
) {
  const passwordHash = hashPassword(SEED_PASSWORD);
  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      authSubject: user.authSubject,
      email: user.email,
      name: user.name,
      passwordHash,
      isOpsAdmin,
      mfaEnabled: isOpsAdmin,
    },
    update: {
      email: user.email,
      name: user.name,
      passwordHash,
      isOpsAdmin,
      mfaEnabled: isOpsAdmin,
    },
  });
}

async function upsertMembership(
  tenantId: string,
  userId: string,
  roleId: string,
  businessUnitId?: string,
) {
  const existing = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId, roleId },
  });
  if (!existing) {
    await prisma.tenantMembership.create({
      data: {
        tenantId,
        userId,
        roleId,
        status: 'ACTIVE',
        ...(businessUnitId ? { businessUnitId } : {}),
      },
    });
    return;
  }
  if (businessUnitId && existing.businessUnitId !== businessUnitId) {
    await prisma.tenantMembership.update({
      where: { id: existing.id },
      data: { businessUnitId },
    });
  }
}
