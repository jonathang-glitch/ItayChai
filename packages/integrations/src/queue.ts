export type QueuePublisher = {
  publish(destination: string, payload: unknown, idempotencyKey: string): Promise<void>;
  close(): Promise<void>;
};

export type QueueConsumer = {
  consume(destination: string, handler: (payload: unknown) => Promise<void>): Promise<void>;
  close(): Promise<void>;
};
