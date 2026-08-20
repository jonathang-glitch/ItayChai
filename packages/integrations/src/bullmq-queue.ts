import { Queue, Worker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import type { QueueConsumer, QueuePublisher } from './queue.js';

function connectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
  };
}

export function createBullmqPublisher(redisUrl: string): QueuePublisher {
  const queues = new Map<string, Queue>();

  const getQueue = (destination: string) => {
    const existing = queues.get(destination);
    if (existing) {
      return existing;
    }
    const queue = new Queue(destination, { connection: connectionFromUrl(redisUrl) });
    queues.set(destination, queue);
    return queue;
  };

  return {
    async publish(destination, payload, idempotencyKey) {
      await getQueue(destination).add('job', payload, {
        jobId: idempotencyKey,
        removeOnComplete: true,
        attempts: 3,
      });
    },
    async close() {
      await Promise.all([...queues.values()].map((queue) => queue.close()));
    },
  };
}

export function createBullmqConsumer(redisUrl: string): QueueConsumer {
  const workers: Worker[] = [];

  return {
    async consume(destination, handler) {
      const worker = new Worker(
        destination,
        async (job) => {
          await handler(job.data);
        },
        { connection: connectionFromUrl(redisUrl), concurrency: 1 },
      );
      workers.push(worker);
    },
    async close() {
      await Promise.all(workers.map((worker) => worker.close()));
    },
  };
}
