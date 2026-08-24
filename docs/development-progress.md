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
| 6 Shift Agent | **Started — cover / swap / either** | Roster search, coworker offers, first-cover commit, two-sided swap, either (cover or swap). Owner still has fallback buttons. No roster vendor, no WhatsApp templates, no vacancy KPIs |
| 7 Digital Caretaker | Not started | |
| 8 Procurement / payments | Not started | |
| 9 Client surfaces | Started | Owner/customer web can run the shift agent. Ops console is a shell. Mobile is a placeholder |
| 10 Hardening / pilot | Not started | |

## What this shift slice is

אורי picks a shift and chooses **כיסוי**, **החלפה**, or **כיסוי / החלפה**. The agent messages דנה and יוסי (off that day). מיכל is on Friday and is skipped.

- Cover: first coworker yes moves Friday. No second confirm.
- Swap: coworker yes proposes their next shift; אורי must confirm. Then the two shifts trade.
- Either: coworkers can cover or swap. A cover on an open search commits now. A swap still needs אורי. A cover during a pending swap is queued and commits only if he refuses.

נועה sees the card the whole time. If nobody is left she gets the old אשר / דחה / צריך מחליף buttons.

Full workflow: [docs/shift-agent-workflows.md](shift-agent-workflows.md).

## Seeded people

- נועה / `owner-a@example.com` — tenant A owner
- אורי / `customer-a@example.com` — requester, this week plus a second Friday
- דנה / `dana-a@example.com` — off Friday, Sunday evening then next Friday evening
- יוסי / `yossi-a@example.com` — off Friday, Saturday morning then the next Saturday
- רועי / `roi-a@example.com` — no upcoming shifts; Either shows cover only
- שירה / `shira-a@example.com` — off Friday, works Saturday evening
- מיכל — roster only, works Friday, no login

`pnpm db:seed` resets the roster and clears conversation rows.

## Exit rule

Do not start Caretaker, Procurement, or a full AI Gateway until this slice is the demo people can click through. Full Phase 6 still needs WhatsApp templates and vacancy KPIs later.
