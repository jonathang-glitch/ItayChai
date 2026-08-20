# ADR 0003: Supabase PostgreSQL and Prisma

## Status

Accepted

## Decision

PostgreSQL is the source of truth. Local and hosted data use Supabase Postgres. Prisma owns the schema and migrations. NestJS writes through Prisma and `DATABASE_URL`, not the Supabase JavaScript client.

## Why

The walking skeleton needs one SQL transaction for the session, event, outbox, and audit rows. Prisma can do that. The Supabase JS client cannot.

## Tradeoff

The original PRD asked for AWS Israel (Tel Aviv). Supabase does not host in that region. This is an accepted pilot tradeoff. Revisit if Israel residency becomes a hard legal requirement.
