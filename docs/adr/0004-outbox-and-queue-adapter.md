# ADR 0004: Transactional outbox and queue adapter

## Status

Accepted

## Decision

HTTP handlers write domain events to `outbox_messages` in the same transaction as the state change. `apps/outbox-relay` publishes those rows. Local publishing uses Redis and BullMQ behind `QueuePublisher` / `QueueConsumer`.

## Why

The request must finish without waiting on a queue. A later SQS implementation can replace the BullMQ adapter without changing domain code.
