import { MOCK_WHATSAPP_REPLY } from '@itay-chai/contracts';

export type WhatsAppAdapter = {
  reply(text?: string): Promise<{ body: string }>;
};

export class MockWhatsAppAdapter implements WhatsAppAdapter {
  async reply(): Promise<{ body: string }> {
    return { body: MOCK_WHATSAPP_REPLY };
  }
}
