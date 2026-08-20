import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { runWithTenant } from '@itay-chai/auth';
import { applyTenantRls } from '@itay-chai/database';
import type { RequestAuth } from './auth.types';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { auth?: RequestAuth }>();
    const auth = request.auth;
    if (!auth) {
      return next.handle();
    }
    return from(
      runWithTenant(auth, async () => {
        await applyTenantRls(auth.tenantId);
        return lastValueFrom(next.handle());
      }),
    );
  }
}
