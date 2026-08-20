import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';
import { PERMISSIONS } from '@itay-chai/contracts';
import { requireTenantContext } from '@itay-chai/auth';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { assertPermission } from '../auth/require-permission';
import { parseBody } from '../http/parse-body';
import { createVisibleFailure, listOpenDlq, replayDlq } from './dlq.service';

const replaySchema = z.object({
  reason: z.string().min(8),
});

@Controller('api/v1/ops/dlq')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class DlqController {
  @Get()
  async list() {
    const context = requireOps();
    return listOpenDlq(context.tenantId);
  }

  @Post('failures')
  @HttpCode(201)
  async fail() {
    const context = requireOps();
    return createVisibleFailure(context.tenantId);
  }

  @Post(':id/replay')
  async replay(@Param('id') id: string, @Body() body: unknown) {
    const parsed = parseBody(replaySchema, body);
    const context = requireOps();
    if (!context.userId) {
      throw new ForbiddenException('Authenticated operator is required');
    }
    return replayDlq({
      tenantId: context.tenantId,
      dlqItemId: id,
      userId: context.userId,
      reason: parsed.reason,
    });
  }
}

function requireOps() {
  const context = requireTenantContext();
  assertPermission(PERMISSIONS.DLQ_REPLAY);
  if (context.actorType !== 'ops' || !context.mfaSatisfied) {
    throw new ForbiddenException('Operations admins require MFA');
  }
  return context;
}
