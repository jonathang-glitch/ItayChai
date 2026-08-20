import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { InvitationsModule } from './invitations/invitations.module';
import { OpsModule } from './ops/ops.module';
import { SessionsModule } from './sessions/sessions.module';
import { WhatsAppWebhookModule } from './webhooks/whatsapp/whatsapp-webhook.module';

@Module({
  imports: [
    HealthModule,
    WhatsAppWebhookModule,
    AuthModule,
    SessionsModule,
    OpsModule,
    InvitationsModule,
    DevicesModule,
  ],
})
export class AppModule {}
