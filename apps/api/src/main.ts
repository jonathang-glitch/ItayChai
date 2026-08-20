import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { loadEnv } from '@itay-chai/config';
import { createLogger } from '@itay-chai/observability';
import { AppModule } from './app.module';

loadDotenv({ path: resolve(__dirname, '../../../.env') });

async function bootstrap() {
  const env = loadEnv();
  const logger = createLogger('api');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  await app.listen(env.API_PORT);
  logger.info({ port: env.API_PORT }, 'api listening');
}

void bootstrap();
