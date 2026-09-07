import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  InternalServerErrorException,
  Post,
  Query,
} from '@nestjs/common';
import { loadEnv } from '@itay-chai/config';
import { mockWhatsAppWebhookSchema } from '@itay-chai/contracts';
import { handleWhatsAppInbound } from './handle-inbound';
import { ingestMockWhatsApp } from './whatsapp-webhook.service';

@Controller('api/v1/webhooks/whatsapp')
export class WhatsAppWebhookController {
  @Get()
  @Header('Content-Type', 'text/plain')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    const expected = loadEnv().WHATSAPP_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === expected && challenge) {
      return challenge;
    }
    throw new ForbiddenException();
  }

  @Post()
  @HttpCode(200)
  inbound(@Body() body: unknown) {
    return handleWhatsAppInbound(body);
  }

  @Post('mock')
  @HttpCode(200)
  async mock(@Body() body: unknown) {
    const parsed = mockWhatsAppWebhookSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    try {
      return await ingestMockWhatsApp(parsed.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ingest failed';
      throw new InternalServerErrorException(message);
    }
  }
}
