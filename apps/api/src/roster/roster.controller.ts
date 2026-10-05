import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';
import { PERMISSIONS } from '@itay-chai/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { assertPermission } from '../auth/require-permission';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { parseBody } from '../http/parse-body';
import { createShift, deleteShift, listShifts, updateShift } from './roster-shifts';
import { createWorker, deleteWorker, getShop, listWorkers, updateOwnerPhone, updateWorker } from './roster-workers';

const createWorkerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(80),
  whatsapp: z.string().trim().min(8).max(20),
});

const patchWorkerSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    password: z.string().min(8).max(80).optional(),
    whatsapp: z.string().trim().min(8).max(20).optional(),
  })
  .refine((body) => Boolean(body.name || body.password || body.whatsapp), { message: 'Nothing to change' });

const shiftSchema = z.object({
  employeeId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const shiftPatchSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const phoneSchema = z.object({
  whatsapp: z.string().trim().min(8).max(20),
});

@Controller('api/v1/roster')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class RosterController {
  @Get('workers')
  workers() {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return listWorkers();
  }

  @Post('workers')
  @HttpCode(201)
  addWorker(@Body() body: unknown) {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return createWorker(parseBody(createWorkerSchema, body));
  }

  @Patch('workers/:id')
  patchWorker(@Param('id') id: string, @Body() body: unknown) {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return updateWorker(id, parseBody(patchWorkerSchema, body));
  }

  @Delete('workers/:id')
  removeWorker(@Param('id') id: string) {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return deleteWorker(id);
  }

  @Get('shifts')
  shifts() {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return listShifts();
  }

  @Post('shifts')
  @HttpCode(201)
  addShift(@Body() body: unknown) {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return createShift(parseBody(shiftSchema, body));
  }

  @Patch('shifts/:id')
  patchShift(@Param('id') id: string, @Body() body: unknown) {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return updateShift(id, parseBody(shiftPatchSchema, body));
  }

  @Delete('shifts/:id')
  removeShift(@Param('id') id: string) {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return deleteShift(id);
  }

  @Get('me')
  me() {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return getShop();
  }

  @Patch('me')
  patchMe(@Body() body: unknown) {
    assertPermission(PERMISSIONS.TENANT_MANAGE);
    return updateOwnerPhone(parseBody(phoneSchema, body).whatsapp);
  }
}
