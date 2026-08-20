import { Body, Controller, HttpCode, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { PERMISSIONS, ROLE_NAMES } from '@itay-chai/contracts';
import { requireTenantContext } from '@itay-chai/auth';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { assertPermission } from '../auth/require-permission';
import { parseBody } from '../http/parse-body';
import { createInvitation } from './invitations.service';

const inviteSchema = z.object({
  email: z.string().email(),
  roleName: z.enum([ROLE_NAMES.OWNER, ROLE_NAMES.STAKEHOLDER]),
});

@Controller('api/v1/invitations')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class InvitationsController {
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const parsed = parseBody(inviteSchema, body);
    const context = requireTenantContext();
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    if (!context.userId) {
      throw new Error('Authenticated user is required');
    }
    return createInvitation({
      tenantId: context.tenantId,
      email: parsed.email,
      roleName: parsed.roleName,
      invitedByUserId: context.userId,
    });
  }
}
