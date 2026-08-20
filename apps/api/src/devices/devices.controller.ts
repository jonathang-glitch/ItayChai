import { Body, Controller, HttpCode, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { hashToken, requireTenantContext } from '@itay-chai/auth';
import { prisma } from '@itay-chai/database';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { parseBody } from '../http/parse-body';

const registerSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  installationId: z.string().min(8),
  pushToken: z.string().min(1).optional(),
});

@Controller('api/v1/devices')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class DevicesController {
  @Post()
  @HttpCode(201)
  async register(@Body() body: unknown) {
    const parsed = parseBody(registerSchema, body);
    const context = requireTenantContext();
    if (!context.userId) {
      throw new Error('Authenticated user is required');
    }
    const installationIdHash = hashToken(parsed.installationId);
    const device = await prisma.userDevice.upsert({
      where: { installationIdHash },
      create: {
        userId: context.userId,
        platform: parsed.platform,
        installationIdHash,
        ...(parsed.pushToken ? { pushToken: parsed.pushToken } : {}),
      },
      update: {
        userId: context.userId,
        platform: parsed.platform,
        lastSeenAt: new Date(),
        ...(parsed.pushToken ? { pushToken: parsed.pushToken } : {}),
      },
    });
    return { id: device.id, platform: device.platform };
  }
}
