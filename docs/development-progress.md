# Itay Chai development progress

Source of truth: the 10-phase MVP process (`itay-chai-mvp-10-phase-development-process.md`).

This repository is **Itay Chai**, a multi-tenant operations platform. It is not Memories & People / AVI.

## Current phase map

| Phase | Status | What exists |
|---:|---|---|
| 1 Walking skeleton | Done | Monorepo, mock WhatsApp ingest, session/outbox/worker, ADRs, CI |
| 2 Identity and tenancy | Done | Tenants, users, roles, memberships, login, RLS, two seeded tenants |
| 3 Reliability | Done | Domain events, outbox, inbox, DLQ, audit, job attempts |
| 4 AI Gateway / safety runtime | Not started | Status names only. No tool registry, approvals, budgets, or kill switches |
| 5 Real WhatsApp / notifications | Not started | Mock / web chat only |
| 6 Shift Agent | **Started — thin slice** | Manual roster, one employee (אורי), three shifts, owner decision. No peer offers, no roster vendor, no auto-commit |
| 7 Digital Caretaker | Not started | |
| 8 Procurement / payments | Not started | |
| 9 Client surfaces | Started | Owner/customer web can show the shift slice. Ops console is a shell. Mobile is a placeholder |
| 10 Hardening / pilot | Not started | |

## What the thin shift slice is

Not the full Phase 6 exit gate. It is the first thing a business owner can see:

1. אורי picks one of his seeded shifts and sends. No note is required.
2. The existing request path still writes one `agent_sessions` row plus messages/outbox/audit.
3. A `shift_swap_requests` row stores who and which shift.
4. נועה sees name, shift, and time, then can **approve**, **reject**, or mark **needs a replacement**.

Still missing from Phase 6: eligibility rules, offers to coworkers, first-accept commit, WhatsApp templates, vacancy KPIs.

## Seeded people

- נועה / `owner-a@example.com` — tenant A owner
- אורי / `customer-a@example.com` — tenant A customer and roster employee

`pnpm db:seed` keeps אורי’s five test shifts and clears conversation rows so both start with an empty chat.

## Exit rule

Do not start Caretaker, Procurement, or a full AI Gateway until this slice is the demo people can click through. Full Phase 6 still needs its own exit gate later.
