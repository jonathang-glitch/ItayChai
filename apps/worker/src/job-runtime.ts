import { AGENT_SESSION_QUEUE } from '@itay-chai/contracts';
import {
  claimIdempotency,
  finishJobAttempt,
  quarantineJob,
  startJobAttempt,
} from '@itay-chai/database';
import { classifyJobError, isRetryable } from '@itay-chai/domain';
import { createLogger } from '@itay-chai/observability';

const logger = createLogger('worker');

type JobPayload = {
  tenantId?: string;
  eventId?: string;
  sessionId?: string;
  correlationId?: string;
  eventType?: string;
};

export async function runReliableJob(
  payload: unknown,
  handler: (payload: unknown) => Promise<void>,
): Promise<void> {
  const job = payload as JobPayload;
  if (!job.tenantId) {
    throw new Error('Worker job missing tenantId');
  }
  const jobKey = job.eventId ?? job.sessionId ?? 'unknown';
  const attempt = await startJobAttempt(job.tenantId, jobKey);
  const log = logger.child({
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    eventId: job.eventId,
    correlationId: job.correlationId,
    attempt: attempt.attempt,
  });

  try {
    await handler(payload);
    await claimIdempotency(job.tenantId, AGENT_SESSION_QUEUE, jobKey);
    await finishJobAttempt(attempt.id);
    log.info('job completed');
  } catch (error) {
    const classified = classifyJobError(error);
    await finishJobAttempt(attempt.id, {
      errorClass: classified.errorClass,
      errorMessage: classified.message,
    });
    log.error({ errorClass: classified.errorClass, err: classified.message }, 'job failed');
    if (!isRetryable(classified.errorClass)) {
      await quarantineJob({
        tenantId: job.tenantId,
        destination: AGENT_SESSION_QUEUE,
        ...(job.eventId ? { eventId: job.eventId } : {}),
        payload,
        errorClass: classified.errorClass,
        originalError: classified.message,
      });
      return;
    }
    throw error;
  }
}
