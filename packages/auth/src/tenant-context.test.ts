import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireTenantContext, runWithTenant } from './tenant-context.js';

test('jobs without tenant context fail closed', () => {
  assert.throws(() => requireTenantContext(), /missing tenant context/);
});

test('runWithTenant exposes tenantId', () => {
  const tenantId = runWithTenant(
    { tenantId: 'tenant-a', actorType: 'service', permissions: [], mfaSatisfied: false },
    () => requireTenantContext().tenantId,
  );
  assert.equal(tenantId, 'tenant-a');
});
