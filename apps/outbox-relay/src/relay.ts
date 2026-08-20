import { AGENT_SESSION_QUEUE } from '@itay-chai/contracts';
import { prisma, quarantineJob, type Prisma } from '@itay-chai/database';
import type { QueuePublisher } from '@itay-chai/integrations';

const MAX_PUBLISH_ATTEMPTS = 8;

type ClaimedOutbox = {
  id: string;
  event_id: string;
  destination: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

export function outboxJobId(eventId: string): string {
  return eventId;
}

function alreadyQueued(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists/i.test(message);
}

export async function relayOnce(publisher: QueuePublisher): Promise<number> {
  const claimed = await prisma.$queryRaw<ClaimedOutbox[]>`
    UPDATE outbox_messages
    SET attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM outbox_messages
      WHERE published_at IS NULL
        AND attempts < ${MAX_PUBLISH_ATTEMPTS}
      ORDER BY created_at
      LIMIT 20
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, event_id, destination, payload, attempts
  `;

  for (const row of claimed) {
    try {
      await publisher.publish(row.destination, row.payload, outboxJobId(row.event_id));
      await prisma.outboxMessage.update({
        where: { id: row.id },
        data: { publishedAt: new Date(), lastError: null },
      });
    } catch (error) {
      if (alreadyQueued(error)) {
        await prisma.outboxMessage.update({
          where: { id: row.id },
          data: { publishedAt: new Date(), lastError: null },
        });
        continue;
      }
      const message = error instanceof Error ? error.message : 'publish failed';
      await prisma.outboxMessage.update({
        where: { id: row.id },
        data: { lastError: message },
      });
      if (row.attempts >= MAX_PUBLISH_ATTEMPTS) {
        const payload = row.payload as { tenantId?: string };
        await quarantineJob({
          tenantId: payload.tenantId ?? '00000000-0000-4000-8000-000000000001',
          destination: row.destination || AGENT_SESSION_QUEUE,
          eventId: row.event_id,
          payload: row.payload,
          errorClass: 'TRANSIENT',
          originalError: message,
        });
      }
    }
  }

  return claimed.length;
}
