# ADR 0007: Reliable jobs, quarantine, and replay

## Status

Accepted

## Decision

Every state change writes one domain event and one outbox row in the same transaction. The outbox relay publishes with locking. Workers record attempts, skip duplicates, send permanent errors to a DLQ, and retry only transient errors. Ops can inspect an open DLQ item and replay it with a written reason. The original payload stays immutable.

Local queues stay on Redis/BullMQ. A later SQS adapter can replace the publisher without changing this flow.

## Why

An agent that acts in the real world cannot lose a job, run it twice, or fail in silence.
