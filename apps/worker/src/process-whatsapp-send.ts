import { WHATSAPP_SEND_REQUESTED, type WhatsAppSendRequestedPayload } from '@itay-chai/contracts';
import { prisma } from '@itay-chai/database';
import { PermanentJobError } from '@itay-chai/domain';
import { createWhatsAppAdapter } from '@itay-chai/integrations';

const adapter = createWhatsAppAdapter();

export async function processWhatsAppSend(raw: unknown): Promise<void> {
  const payload = raw as WhatsAppSendRequestedPayload;
  if (payload.eventType !== WHATSAPP_SEND_REQUESTED) {
    throw new PermanentJobError(`Unsupported event ${String(payload.eventType)}`);
  }
  if (!payload.to || !payload.text) {
    throw new PermanentJobError('WhatsApp send job missing to or text', 'VALIDATION');
  }

  const existing = await prisma.auditEntry.findFirst({
    where: { resourceId: payload.eventId, action: 'whatsapp.sent' },
  });
  if (existing) {
    return;
  }

  const sent = await adapter.send({
    to: payload.to,
    text: payload.text,
    ...(payload.buttons ? { buttons: payload.buttons } : {}),
  });
  await prisma.auditEntry.create({
    data: {
      tenantId: payload.tenantId,
      actorType: 'system',
      action: 'whatsapp.sent',
      resourceType: 'WhatsAppSend',
      resourceId: payload.eventId,
      metadata: { to: payload.to, userId: payload.userId, providerMessageId: sent.providerMessageId },
    },
  });
}
