import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';
import { PERMISSIONS } from '@itay-chai/contracts';
import { requireTenantContext } from '@itay-chai/auth';
import { prisma } from '@itay-chai/database';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { assertPermission } from '../auth/require-permission';
import { parseBody } from '../http/parse-body';

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().min(8),
});

@Controller('api/v1/ops/break-glass')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class BreakGlassController {
  @Post()
  @HttpCode(201)
  async grant(@Body() body: unknown) {
    const parsed = parseBody(bodySchema, body);
    const context = requireTenantContext();
    assertPermission(PERMISSIONS.BREAK_GLASS);
    if (context.actorType !== 'ops' || !context.mfaSatisfied) {
      throw new ForbiddenException('Operations admins require MFA and a reason');
    }

    const grant = await prisma.breakGlassGrant.create({
      data: {
        actorUserId: context.userId ?? 'unknown',
        tenantId: parsed.tenantId,
        reason: parsed.reason,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await prisma.auditEntry.create({
      data: {
        tenantId: parsed.tenantId,
        actorType: 'ops',
        action: 'break_glass.granted',
        resourceType: 'Tenant',
        resourceId: parsed.tenantId,
        metadata: { reason: parsed.reason, grantId: grant.id },
      },
    });
    return grant;
  }
}
