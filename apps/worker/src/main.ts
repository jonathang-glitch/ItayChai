import { AGENT_SESSION_QUEUE } from '@itay-chai/contracts';
import { loadEnv } from '@itay-chai/config';
import { prisma } from '@itay-chai/database';
import { createBullmqConsumer } from '@itay-chai/integrations';
import { createLogger } from '@itay-chai/observability';
import { processAgentSessionJob } from './process-session.js';

const logger = createLogger('worker');

async function main() {
  const env = loadEnv();
  const consumer = createBullmqConsumer(env.REDIS_URL);

  await prisma.$queryRaw`SELECT 1`;
  await consumer.consume(AGENT_SESSION_QUEUE, processAgentSessionJob);
  logger.info('worker ready');

  const shutdown = async () => {
    await consumer.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
