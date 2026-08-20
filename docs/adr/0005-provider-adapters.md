# ADR 0005: Provider adapters

## Status

Accepted

## Decision

WhatsApp, queues, and later payments, OCR, email, and SMS sit behind typed adapters in `packages/integrations`. Phase 1 includes only a mock WhatsApp adapter and a BullMQ queue adapter.

## Why

Vendor APIs change. The core session and audit rules must not import GreenAPI, Meta, or AWS SDK types.
