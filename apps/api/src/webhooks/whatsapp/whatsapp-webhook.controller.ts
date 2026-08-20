import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { mockWhatsAppWebhookSchema } from '@itay-chai/contracts';
import { ingestMockWhatsApp } from './whatsapp-webhook.service';

@Controller('api/v1/webhooks/whatsapp')
export class WhatsAppWebhookController {
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
