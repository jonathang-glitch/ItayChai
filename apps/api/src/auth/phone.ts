import { BadRequestException, ConflictException } from '@nestjs/common';
import { WHATSAPP_PROVIDER } from '@itay-chai/contracts';
import { prisma } from '@itay-chai/database';
import { normalizeWhatsAppId } from '@itay-chai/domain';

export function requireWhatsAppNumber(raw: string) {
  const phone = normalizeWhatsAppId(raw);
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new BadRequestException('Enter a phone number with country code');
  }
  return phone;
}

export async function assertWhatsAppFree(phone: string, exceptUserId?: string) {
  const taken = await prisma.stakeholderIdentity.findFirst({
    where: {
      channel: WHATSAPP_PROVIDER,
      externalId: phone,
      ...(exceptUserId ? { NOT: { userId: exceptUserId } } : {}),
    },
    select: { id: true },
  });
  if (taken) {
    throw new ConflictException('Phone already used');
  }
}
