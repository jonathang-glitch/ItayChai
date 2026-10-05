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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { loadEnv } from '@itay-chai/config';
import { mockWhatsAppWebhookSchema } from '@itay-chai/contracts';
import { createWhatsAppAdapter } from '@itay-chai/integrations';
import { handleWhatsAppInbound } from './handle-inbound';
import { ingestMockWhatsApp } from './whatsapp-webhook.service';

function webhookUrl(req: Request) {
  const configured = process.env.TWILIO_WEBHOOK_URL?.trim();
  if (configured) {
    return configured;
  }
  const proto = req.header('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
  const host = req.header('x-forwarded-host')?.split(',')[0]?.trim() || req.header('host');
  return `${proto}://${host}${req.originalUrl}`;
}

function stringParams(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string') {
      return null;
    }
    params[key] = value;
  }
  return params;
}

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
  inbound(@Req() req: Request, @Body() body: unknown) {
    if ((process.env.WHATSAPP_PROVIDER ?? 'mock') === 'twilio') {
      const params = stringParams(body);
      const signature = req.header('x-twilio-signature');
      const accepted =
        params &&
        createWhatsAppAdapter().verifyWebhook(
          { 'x-twilio-signature': signature, 'x-request-url': webhookUrl(req) },
          JSON.stringify(params),
        );
      if (!accepted) {
        throw new ForbiddenException();
      }
    }
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
