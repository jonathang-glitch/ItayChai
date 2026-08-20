# ADR 0006: Supabase Auth and application tenancy

## Status

Accepted

## Decision

Identity tokens come from Supabase Auth (JWT). The API verifies the JWT, then loads `users` and `tenant_memberships` from PostgreSQL. Tenant context is required on every authenticated request and every worker job.

Local login checks `users.password_hash` and issues a short-lived access token plus a rotating refresh token stored in `auth_sessions`. Recovery and invitations return one-time tokens in development and test only. The production adapter will send those tokens through email and can accept live Supabase Auth JWTs on the same verify path.

## Why

The product already uses Supabase for data. Cognito would add a second identity vendor. Application-level tenant checks plus PostgreSQL RLS are the two isolation layers.
