# Itay Chai tables

Short why for each table in Docker Postgres (`127.0.0.1:54322`).

## Who owns what

| Table | Why we have it |
|---|---|
| `tenants` | One row per business, so A and B never share a pile of data. |
| `business_units` | A shop/property/agency under a tenant, for more than one site later. |
| `users` | A person who can log in, separate from which business they belong to. |
| `roles` | Owner, stakeholder, ops — the job title. |
| `permissions` | The actual rights we check (`session.read`, and so on). |
| `role_permissions` | Which role has which right. |
| `tenant_memberships` | This user belongs to this business as this role — the isolation lock. |

## Login and access

| Table | Why we have it |
|---|---|
| `auth_sessions` | A live login we can expire or revoke. |
| `password_reset_tokens` | One-time reset, so we never store or email the password. |
| `invitations` | An owner can add someone to their business. |
| `user_devices` | Which phone/app install to notify later. |
| `break_glass_grants` | Written, time-limited emergency access — no silent back door. |
| `stakeholder_identities` | This WhatsApp number is this person in this business. Seeded with mock `+97250…` phones until Meta is live. |

## The WhatsApp job

| Table | Why we have it |
|---|---|
| `employees` | A person on the store roster. אורי, דנה, יוסי, רועי, שירה, and מיכל are seeded here. |
| `shifts` | One planned shift for an employee (day and hours). |
| `shift_swap_requests` | אורי asked to change a shift; cover, swap, or either, plus the outcome. |
| `shift_offers` | One ask sent to a coworker for that request. |
| `agent_sessions` | One work item from a customer message, and its status. |
| `session_transitions` | Each status change, so we can prove the path. |
| `messages` | Inbound and outbound text for that job. |
| `webhook_receipts` | We already accepted this provider message — no second job on retry. |
| `inbox_messages` | Second duplicate lock on the inbox path. |

## Trail, queue, and failures

| Table | Why we have it |
|---|---|
| `domain_events` | “This happened” — the fact of a change, not only the latest row. |
| `outbox_messages` | That event must be published; survives a crash better than Redis alone. |
| `audit_entries` | Who did what, on which thing. |
| `idempotency_records` | We already ran this exact action — no double create. |
| `job_attempts` | Each try of a background job. |
| `dlq_items` | A job that failed and was quarantined so it stays visible. |
| `dlq_replays` | Who replayed a failure, with a written reason. |

## Bookkeeping

| Table | Why we have it |
|---|---|
| `_prisma_migrations` | Which schema versions were applied, so code and DB match. |

Redis (`itaychai-redis-1`) is the live queue, not a table. `.env` holds connection URLs and secrets, not product rows.
