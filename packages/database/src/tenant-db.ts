import { PrismaClient, type Prisma } from '@prisma/client';
import { loadEnv } from '@itay-chai/config';

const env = loadEnv();

export const appPrisma = new PrismaClient({
  datasources: {
    db: { url: env.DATABASE_APP_URL ?? env.DATABASE_URL },
  },
  transactionOptions: {
    maxWait: 10_000,
    timeout: 20_000,
  },
});

export async function withTenantDb<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    throw new Error('Tenant id is required for a tenant-scoped query');
  }
  return appPrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
