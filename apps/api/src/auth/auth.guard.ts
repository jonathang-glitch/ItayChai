import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ROLE_PERMISSIONS, verifyAccessToken } from '@itay-chai/auth';
import { prisma } from '@itay-chai/database';
import type { RequestAuth } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { auth?: RequestAuth }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let subject: string;
    let amr: string[] | undefined;
    try {
      const claims = await verifyAccessToken(header.slice(7));
      subject = claims.sub;
      amr = claims.amr;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await prisma.user.findUnique({ where: { authSubject: subject } });
    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }

    const requestedTenant = headerValue(request, 'x-tenant-id');
    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const membership = requestedTenant
      ? memberships.find((item) => item.tenantId === requestedTenant)
      : memberships[0];

    if (!membership && !user.isOpsAdmin) {
      throw new ForbiddenException('No tenant membership');
    }

    const tenantId = membership?.tenantId ?? requestedTenant;
    if (!tenantId) {
      throw new ForbiddenException('Tenant is required');
    }

    const permissions = membership
      ? membership.role.permissions.map((item) => item.permission.key)
      : (ROLE_PERMISSIONS.ops_admin ?? []);

    request.auth = {
      tenantId,
      userId: user.id,
      actorType: user.isOpsAdmin ? 'ops' : 'user',
      permissions,
      mfaSatisfied: Boolean(user.mfaEnabled && amr?.includes('mfa')),
    };
    return true;
  }
}

function headerValue(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
