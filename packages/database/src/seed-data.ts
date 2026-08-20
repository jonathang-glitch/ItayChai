import { hashPassword } from '@itay-chai/auth';
import {
  DEV_TENANT_ID,
  PERMISSIONS,
  ROLE_NAMES,
  SECOND_TENANT_ID,
} from '@itay-chai/contracts';
import { prisma } from './index.js';

export const SEED_PASSWORD = 'dev-password';

export const SEED_USERS = {
  ownerA: {
    id: '00000000-0000-4000-8000-000000000011',
    authSubject: 'auth-owner-a',
    email: 'owner-a@example.com',
  },
  ownerB: {
    id: '00000000-0000-4000-8000-000000000012',
    authSubject: 'auth-owner-b',
    email: 'owner-b@example.com',
  },
  ops: {
    id: '00000000-0000-4000-8000-000000000013',
    authSubject: 'auth-ops',
    email: 'ops@example.com',
  },
  stakeholderA: {
    id: '00000000-0000-4000-8000-000000000014',
    authSubject: 'auth-stakeholder-a',
    email: 'stakeholder-a@example.com',
  },
};

export async function seedIdentity() {
  await prisma.tenant.upsert({
    where: { id: DEV_TENANT_ID },
    create: { id: DEV_TENANT_ID, name: 'Development Tenant', status: 'active' },
    update: { name: 'Development Tenant', status: 'active' },
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
  const opsRole = await upsertRole(ROLE_NAMES.OPS_ADMIN, [
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.SESSION_WRITE,
    PERMISSIONS.BREAK_GLASS,
    PERMISSIONS.DLQ_REPLAY,
  ]);

  await prisma.businessUnit.upsert({
    where: { id: '00000000-0000-4000-8000-000000000021' },
    create: {
      id: '00000000-0000-4000-8000-000000000021',
      tenantId: DEV_TENANT_ID,
      kind: 'STORE',
      name: 'Tel Aviv Store',
    },
    update: { name: 'Tel Aviv Store' },
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

  await upsertMembership(DEV_TENANT_ID, SEED_USERS.ownerA.id, ownerRole.id);
  await upsertMembership(SECOND_TENANT_ID, SEED_USERS.ownerB.id, ownerRole.id);
  await upsertMembership(DEV_TENANT_ID, SEED_USERS.ops.id, opsRole.id);
  await upsertMembership(DEV_TENANT_ID, SEED_USERS.stakeholderA.id, stakeholderRole.id);
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
  user: { id: string; authSubject: string; email: string },
  isOpsAdmin: boolean,
) {
  const passwordHash = hashPassword(SEED_PASSWORD);
  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      authSubject: user.authSubject,
      email: user.email,
      passwordHash,
      isOpsAdmin,
      mfaEnabled: isOpsAdmin,
    },
    update: { email: user.email, passwordHash, isOpsAdmin, mfaEnabled: isOpsAdmin },
  });
}

async function upsertMembership(tenantId: string, userId: string, roleId: string) {
  const existing = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId, roleId },
  });
  if (!existing) {
    await prisma.tenantMembership.create({
      data: { tenantId, userId, roleId, status: 'ACTIVE' },
    });
  }
}
