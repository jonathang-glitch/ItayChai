import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { prisma } from '@itay-chai/database';

@Controller('health')
export class HealthController {
  @Get()
  async check() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ ok: false, database: 'down' });
    }
  }
}
