import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext = {
  tenantId: string;
  userId?: string;
  actorType: 'user' | 'ops' | 'service';
  permissions: string[];
  mfaSatisfied: boolean;
  reason?: string;
};

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  if (!context.tenantId) {
    throw new Error('Tenant context requires tenantId');
  }
  return storage.run(context, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function requireTenantContext(): TenantContext {
  const context = storage.getStore();
  if (!context?.tenantId) {
    throw new Error('Background job or request is missing tenant context');
  }
  return context;
}

export function hasPermission(permission: string): boolean {
  const context = requireTenantContext();
  return context.permissions.includes(permission);
}
