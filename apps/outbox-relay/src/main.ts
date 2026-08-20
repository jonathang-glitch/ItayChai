import { loadEnv } from '@itay-chai/config';
import { prisma } from '@itay-chai/database';
import { createBullmqPublisher } from '@itay-chai/integrations';
import { createLogger } from '@itay-chai/observability';
import { relayOnce } from './relay.js';

const logger = createLogger('outbox-relay');

async function main() {
  const env = loadEnv();
  const publisher = createBullmqPublisher(env.REDIS_URL);

  await prisma.$queryRaw`SELECT 1`;
  logger.info('outbox-relay ready');

  const timer = setInterval(() => {
    void relayOnce(publisher).catch((error: unknown) => {
      logger.error({ error }, 'outbox relay failed');
    });
  }, 500);

  const shutdown = async () => {
    clearInterval(timer);
    await publisher.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
