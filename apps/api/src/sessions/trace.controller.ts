import { Controller, Get, NotFoundException, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { PERMISSIONS } from '@itay-chai/contracts';
import { requireTenantContext } from '@itay-chai/auth';
import { findSessionForTenant, sessionTrace } from '@itay-chai/database';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { assertPermission } from '../auth/require-permission';

@Controller('api/v1/sessions')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class TraceController {
  @Get(':id/trace')
  async trace(@Param('id') id: string) {
    const context = requireTenantContext();
    assertPermission(PERMISSIONS.SESSION_READ);
    const session = await findSessionForTenant(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return sessionTrace(context.tenantId, session.id);
  }
}
