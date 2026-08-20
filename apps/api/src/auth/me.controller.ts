import { Controller, Get, UnauthorizedException, UseGuards, UseInterceptors } from '@nestjs/common';
import { requireTenantContext } from '@itay-chai/auth';
import { AuthGuard } from './auth.guard';
import { TenantInterceptor } from './tenant.interceptor';
import { loadProfile } from './auth.service';

@Controller('api/v1/me')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class MeController {
  @Get()
  me() {
    const userId = requireTenantContext().userId;
    if (!userId) {
      throw new UnauthorizedException('User is required');
    }
    return loadProfile(userId);
  }
}
