# ADR 0002: NestJS for HTTP and process entrypoints

## Status

Accepted

## Decision

`apps/api` is a NestJS HTTP server. `apps/worker` and `apps/outbox-relay` are long-running Node processes.

## Why

NestJS matches the PRD. The first webhook is a small controller. Later auth, websockets, and more routes can be added as modules without changing the process layout.
