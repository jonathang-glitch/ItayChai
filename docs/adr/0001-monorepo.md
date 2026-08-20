# ADR 0001: TypeScript monorepo with pnpm and Turborepo

## Status

Accepted

## Decision

The repository is a pnpm workspace. Apps live in `apps/`. Shared code lives in `packages/`. Turborepo runs `dev`, `typecheck`, and `lint`.

## Why

The API, worker, and outbox-relay must share types and database code. One repo keeps those contracts in one place.
