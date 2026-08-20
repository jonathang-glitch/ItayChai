import { Controller, Get, NotFoundException, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { PERMISSIONS } from '@itay-chai/contracts';
import { acknowledgeSession, findSessionsForTenant } from '@itay-chai/database';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { assertPermission } from '../auth/require-permission';

@Controller('api/v1/sessions')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class SessionsController {
  @Get()
  async list() {
    assertPermission(PERMISSIONS.SESSION_READ);
    return findSessionsForTenant();
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
