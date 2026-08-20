import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { PERMISSIONS, SHIFT_DECISIONS } from '@itay-chai/contracts';
import {
  acknowledgeSession,
  decideShiftRequest,
  findSessionForTenant,
  findSessionsForTenant,
} from '@itay-chai/database';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { assertPermission } from '../auth/require-permission';
import { parseBody } from '../http/parse-body';

const decisionSchema = z.object({
  action: z.enum(SHIFT_DECISIONS),
});

@Controller('api/v1/sessions')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class SessionsController {
  @Get()
  async list() {
    assertPermission(PERMISSIONS.SESSION_READ);
    return findSessionsForTenant();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    assertPermission(PERMISSIONS.SESSION_READ);
    const session = await findSessionForTenant(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  @Post(':id/shift-decision')
  @HttpCode(200)
  async decideShift(@Param('id') sessionId: string, @Body() body: unknown) {
    assertPermission(PERMISSIONS.SESSION_WRITE);
    const { action } = parseBody(decisionSchema, body);
    const decided = await decideShiftRequest(sessionId, action);
    if (!decided) {
      throw new NotFoundException('Shift request not found');
    }
    return findSessionForTenant(sessionId);
  }

  @Post(':id/acknowledge')
  async acknowledge(@Param('id') id: string) {
    assertPermission(PERMISSIONS.SESSION_WRITE);
    const session = await acknowledgeSession(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return { ok: true, sessionId: session.id };
  }
}

