import { Body, Controller, Get, HttpCode, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { PERMISSIONS } from '@itay-chai/contracts';
import { parseBody } from '../http/parse-body';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { assertPermission } from '../auth/require-permission';
import {
  createCustomerRequest,
  listCustomerHome,
  listCustomerRequests,
  listCustomerShifts,
} from './customer.service';

const requestSchema = z
  .object({
    text: z.string().trim().max(2000).optional(),
    shiftId: z.string().uuid().optional(),
  })
  .refine((body) => Boolean(body.shiftId || body.text), {
    message: 'Choose a shift to send',
  });

@Controller('api/v1/customer/requests')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class CustomerController {
  @Get('home')
  home() {
    assertPermission(PERMISSIONS.CUSTOMER_WRITE);
    return listCustomerHome();
  }

  @Get('shifts')
  shifts() {
    assertPermission(PERMISSIONS.CUSTOMER_WRITE);
    return listCustomerShifts();
  }

  @Get()
  list() {
    assertPermission(PERMISSIONS.CUSTOMER_WRITE);
    return listCustomerRequests();
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: unknown) {
    assertPermission(PERMISSIONS.CUSTOMER_WRITE);
    return createCustomerRequest(parseBody(requestSchema, body));
  }
}
