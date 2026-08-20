# Itay Chai

Phase 1 walking skeleton plus Phase 2 identity and tenant isolation.

## What this step includes

- TypeScript monorepo (`apps/api`, `apps/worker`, `apps/outbox-relay`)
- Local Supabase Postgres and Redis
- First tables and one development tenant
- `GET /health` that checks the database

Mock WhatsApp path: `POST /api/v1/webhooks/whatsapp/mock`.

## 1. Install tools

This Mac needs these programs. Install them in order.

### Node.js 22

https://nodejs.org/ — install the 22.x LTS build.

Confirm:

```bash
node -v
```

It should print `v22` or higher.

### pnpm

```bash
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm -v
```

### Docker Desktop

https://www.docker.com/products/docker-desktop/ — install, open the app, wait until it says Docker is running.

Confirm:

```bash
docker info
```

### Supabase CLI

```bash
brew install supabase/tap/supabase
supabase --version
```

If you do not have Homebrew: https://brew.sh

## 2. Install project packages

From this folder:

```bash
cp .env.example .env
pnpm install
```

`pnpm install` also generates the Prisma client.

## 3. Start the local system

One command starts Supabase Postgres, Redis, migrations, seed, API, outbox-relay, and worker:

```bash
pnpm start:local
```

`pnpm infra:up`, `pnpm db:setup`, and `pnpm dev` still work as separate steps. Studio: http://localhost:54323.

## 6. Check that it works

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"ok":true,"database":"up"}
```

Open http://localhost:54323 to see the tables in Supabase Studio.

## 7. Mock WhatsApp request

```bash
curl -sS -X POST http://localhost:3000/api/v1/webhooks/whatsapp/mock \
  -H 'Content-Type: application/json' \
  -d '{"externalMessageId":"msg-1","text":"need a shift swap"}'
```

Expected: `{"sessionId":"...","message":"Your request was received."}`

The worker then moves the session `DRAFT → INITIALIZING → PLANNING → COMPLETED`. A second POST with the same `externalMessageId` does not create another session.

```bash
pnpm test
```

`pnpm test` covers the walking-skeleton path, tenant isolation, RLS, and login/refresh/logout.

## 8. Client shells

```bash
pnpm dev:web
```

- Owner portal: http://localhost:5173
- Operations console: http://localhost:5174

Both pages call `GET /health` through the Vite proxy. They are status shells only.

The mobile app is an Expo placeholder in `apps/mobile`. It is not part of the root workspace install. From that folder: `pnpm install && pnpm dev`.

## 9. Local login

Seeded users share the password `dev-password`:

- `owner-a@example.com` — tenant A owner
- `owner-b@example.com` — tenant B owner
- `stakeholder-a@example.com` — tenant A read-only
- `ops@example.com` — operations admin (MFA required for break-glass)

```bash
curl -sS -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner-a@example.com","password":"dev-password"}'
```

Send the access token as `Authorization: Bearer ...` and the tenant as `x-tenant-id`.

## Cloud Supabase instead of local

If you already have a Supabase project, put its Postgres URI in `.env` as `DATABASE_URL`, skip `pnpm infra:up` for the database, and still run Redis locally. Then run `pnpm db:setup` and `pnpm dev`.

## CI and infra

- `.github/workflows/ci.yml` runs types, lint, tests, `pnpm audit`, and Docker image builds.
- `.github/workflows/cd-staging.yml` is a manual promote skeleton. It does not deploy until AWS secrets exist.
- `infra/` is an AWS CDK sketch (VPC + ECS cluster, no RDS). Do not apply it in Phase 1.
- Decisions: [docs/adr](docs/adr).
