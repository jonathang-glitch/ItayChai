import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DEV_TENANT_ID, SECOND_TENANT_ID } from '@itay-chai/contracts';
import { prisma } from './index.js';
import { seedIdentity } from './seed-data.js';
import { appPrisma, withTenantDb } from './tenant-db.js';

let tenantASessionId: string;

before(async () => {
  await seedIdentity();
  const session = await prisma.agentSession.create({
    data: {
      tenantId: DEV_TENANT_ID,
      status: 'COMPLETED',
      version: 3,
      externalMessageId: `rls-${Date.now()}`,
    },
  });
  tenantASessionId = session.id;
});

after(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

test('app role cannot read tenant rows without tenant context', async () => {
  const rows = await appPrisma.agentSession.findMany({
    where: { id: tenantASessionId },
  });
  assert.equal(rows.length, 0);
});

test('tenant B transaction cannot read tenant A session', async () => {
  const rows = await withTenantDb(SECOND_TENANT_ID, (tx) =>
    tx.agentSession.findMany({ where: { id: tenantASessionId } }),
  );
  assert.equal(rows.length, 0);
});

test('tenant A transaction can read its own session', async () => {
  const rows = await withTenantDb(DEV_TENANT_ID, (tx) =>
    tx.agentSession.findMany({ where: { id: tenantASessionId } }),
  );
  assert.equal(rows.length, 1);
});
