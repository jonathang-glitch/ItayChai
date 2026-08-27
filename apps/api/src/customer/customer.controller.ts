import { Body, Controller, Get, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { PERMISSIONS, SHIFT_MATCH_ACTIONS, SHIFT_OFFER_ACTIONS, SHIFT_REQUEST_KINDS } from '@itay-chai/contracts';
import { parseBody } from '../http/parse-body';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../auth/tenant.interceptor';
import { assertPermission } from '../auth/require-permission';
import {
  answerMatch,
  answerOffer,
  cancelCustomerSearch,
  createCustomerRequest,
  listCustomerHome,
  listCustomerRequests,
  listCustomerShifts,
} from './customer.service';

const requestSchema = z
  .object({
    text: z.string().trim().max(2000).optional(),
    shiftId: z.string().uuid().optional(),
    kind: z.enum(SHIFT_REQUEST_KINDS).optional(),
  })
  .refine((body) => Boolean(body.shiftId || body.text), {
    message: 'Choose a shift to send',
  });

const offerSchema = z.object({
  action: z.enum(SHIFT_OFFER_ACTIONS),
  proposedShiftId: z.string().uuid().optional(),
});

const matchSchema = z.object({
  action: z.enum(SHIFT_MATCH_ACTIONS),
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

  @Post(':id/match')
  @HttpCode(200)
  match(@Param('id') id: string, @Body() body: unknown) {
    assertPermission(PERMISSIONS.CUSTOMER_WRITE);
    return answerMatch(id, parseBody(matchSchema, body).action);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string) {
    assertPermission(PERMISSIONS.CUSTOMER_WRITE);
    return cancelCustomerSearch(id);
  }
}

@Controller('api/v1/customer/offers')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class CustomerOffersController {
  @Post(':id')
  @HttpCode(200)
  respond(@Param('id') id: string, @Body() body: unknown) {
    assertPermission(PERMISSIONS.CUSTOMER_WRITE);
    const parsed = parseBody(offerSchema, body);
    return answerOffer(id, parsed.action, parsed.proposedShiftId);
  }
}
