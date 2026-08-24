import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { loadEnv } from '@itay-chai/config';

loadDotenv({ path: resolve(import.meta.dirname, '../../../.env') });

const env = loadEnv();

export const prisma = new PrismaClient({
  datasources: {
    db: { url: env.DATABASE_URL },
  },
  transactionOptions: {
    maxWait: 10_000,
    timeout: 20_000,
  },
});

export async function applyTenantRls(tenantId: string) {
  await prisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
}

export { Prisma, SessionStatus, MessageDirection } from '@prisma/client';
export type { Tenant, AgentSession, User } from '@prisma/client';
export { seedIdentity, resetClientInbox, SEED_USERS, SEED_PASSWORD } from './seed-data.js';
export {
  SEED_SHIFTS,
  DANA_SEED_SHIFTS,
  DANA_FREE_SHIFT,
  YOSSI_SEED_SHIFTS,
  ROI_SEED_SHIFTS,
  SHIRA_SEED_SHIFTS,
  ORI_EMPLOYEE_ID,
  DANA_EMPLOYEE_ID,
  YOSSI_EMPLOYEE_ID,
  MICHAL_EMPLOYEE_ID,
  ROI_EMPLOYEE_ID,
  SHIRA_EMPLOYEE_ID,
} from './seed-roster.js';
export { appPrisma, withTenantDb } from './tenant-db.js';
export {
  findSessionsForTenant,
  findSessionForTenant,
  findCustomerSessions,
  acknowledgeSession,
} from './sessions.js';
export {
  listMyShifts,
  listShiftsForUser,
  createShiftRequestForSession,
  decideShiftRequest,
  presentShift,
} from './shifts.js';
export type { ShiftDecisionAction } from './shifts.js';
export {
  startShiftSearch,
  listIncomingOffers,
  respondToOffer,
  confirmMatch,
} from './shift-agent.js';
export {
  claimIdempotency,
  releaseIdempotency,
  startJobAttempt,
  finishJobAttempt,
  quarantineJob,
  sessionTrace,
} from './reliability.js';
