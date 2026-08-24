# Shift Agent — Cover, Swap, and Either

Phase 6 slice on the current demo. Same story as today (someone asks, the store answers, the roster changes). Three intents, two commit rules.

- **Cover** — first coworker who says yes takes the shift. The requester is free. No second confirm.
- **Swap** — a coworker offers their next upcoming shift. The requester must confirm that person and that time. Then the two shifts trade.
- **Either** — the requester does not mind which outcome. Coworkers can cover or swap. The first valid finish wins.

The agent is a workflow. It does not invent eligible people. Commit is one database transaction so two “yes” taps cannot both win.

---

## People in the demo

| Person | Login | Role |
|---|---|---|
| נועה | `owner-a@example.com` | Owner. Watches the desk. Does not pick the winner. |
| אורי | `customer-a@example.com` | Requester. Friday morning plus a full week, and a second Friday. |
| דנה | `dana-a@example.com` | Off Friday. Next shift Sunday evening, then next Friday evening. |
| יוסי | `yossi-a@example.com` | Off Friday. Next shift Saturday morning, then the Saturday after. |
| רועי | `roi-a@example.com` | Off every day, no upcoming shifts. Cover only on Either. |
| שירה | `shira-a@example.com` | Off Friday. Works Saturday evening (same slot as אורי). |
| מיכל | roster only | Working Friday morning. Must **not** get a Friday offer. |

Same store, same tenant. Other tenants still see nothing.

---

## How the requester starts

They pick one of their shifts. Then they choose the intent:

1. **כיסוי** — I cannot work this shift. Find someone to take it. I do not take theirs.
2. **החלפה** — I want to trade this shift for someone else’s upcoming shift.
3. **כיסוי / החלפה** — Cover or swap is fine. Take the first outcome that can finish.

That choice is stored on the request (`kind = COVER | SWAP | EITHER`). נועה’s old buttons (אשר / דחה / צריך מחליף) stay as a fallback if the search dies, and as the path when no `kind` is sent (owner-only thin slice).

---

## Shared rules

### Who is eligible

Same tenant, same store, active employee, not the requester, not already working that calendar day (Asia/Jerusalem).

| Extra rule | Cover | Swap | Either |
|---|---|---|---|
| Offered cover (“take Friday”) | yes | no | yes |
| Offered swap (needs an upcoming shift on another day) | no | yes, required | yes, if they have one |

מיכל works Friday → no offer in any flow.

A coworker on Either who is off Friday but has no later shift only sees cover.

### What “upcoming shift” means

The coworker’s earliest future shift that is not on the same calendar day as the requested shift. That is the shift named in a swap offer (“ראשון בערב”).

### One open search per shift

No second Cover, Swap, or Either on a shift that already has a `SEEKING` or `MATCH_PROPOSED` request.

### Messages and owner desk

Requester chat and owner desk use the existing `agent_sessions` + `messages` path. Coworkers see incoming offers on their home screen. נועה sees the card the whole time. She is not asked to pick דנה vs יוסי.

### Commit

Always one transaction: lock the request, check it is still in the right status, write the roster change, close leftover offers, write messages, audit. A late “yes” gets «כבר נתפס.»

---

## Request states

```
OPEN                 owner-only path (no kind / no search)
  → SEEKING          offers are out
  → MATCH_PROPOSED   waiting for the requester to confirm a swap
  → COMMITTED        roster changed
  → UNFILLED         nobody left; owner fallback buttons return
  → CANCELLED        requester or owner stopped it
  → REJECTED         owner rejected
  → APPROVED         owner-only approve (old path; shift removed)
  → NEEDS_REPLACEMENT
```

## Offer states

```
PENDING       sent, no answer
ACCEPTED      coworker said yes (cover committed, or swap waiting / done)
DECLINED      coworker or requester said no
QUEUED        said yes, but another match is in front
CANCELLED     search closed or someone else won
```

---

## Feature 1 — Cover (first one wins)

אורי needs out. The first coworker who says yes takes Friday. אורי does not confirm. Shifts are not traded.

1. אורי picks Friday morning and taps **כיסוי**.  
   Request: `kind=COVER`, `status=SEEKING`.  
   Chat: «מחפשים מחליף לשישי בבוקר. נעדכן.»  
   נועה: «אורי ביקש כיסוי · שישי בבוקר · מחפשים מחליף»

2. Agent messages people who are off that day.  
   דנה and יוסי: «אורי צריך מחליף בשישי בבוקר (08:00–14:00). אפשר לקחת?»  
   Buttons: **כן** / **לא**  
   מיכל is skipped.

3. דנה taps **כן** first. In one write: Friday’s `employeeId` moves to דנה, other offers cancel, request → `COMMITTED`.

4. Messages:  
   - דנה: «את בשישי בבוקר.»  
   - אורי: «דנה לוקחת את שישי בבוקר. המשמרת ירדה ממך.»  
   - יוסי: «כבר לא צריך — נמצא מחליף.»  
   - נועה: «דנה מחליפה את אורי בשישי בבוקר.»

5. Rosters: אורי loses Friday. דנה has Friday and still has Sunday. יוסי unchanged.

A coworker **לא** leaves the search open. If nobody is left → `UNFILLED` and owner fallback. Two **כן** taps: first commit wins. Cancel / owner reject closes leftover offers.

Cover never asks אורי “ok with דנה?” and never moves דנה’s Sunday.

---

## Feature 2 — Swap (two-sided confirm)

אורי wants to trade. A coworker saying yes is not enough.

1. אורי taps **החלפה**.  
   Request: `kind=SWAP`, `status=SEEKING`.  
   Chat: «מחפשים מי שיחליף איתך את שישי בבוקר.»

2. Agent messages people who are off that day **and** have an upcoming shift.  
   דנה: «אורי רוצה להחליף את שישי בבוקר. אצלך ראשון בערב. מחליפים?»  
   יוסי: «… אצלך שבת בבוקר. מחליפים?»

3. דנה taps **כן**. Nothing moves. Request → `MATCH_PROPOSED`.  
   אורי is asked: «דנה מוכנה להחליף. כך שאתה תעשה ראשון בערב (30 באוג'). האם מאשר?»  
   יוסי can still answer; he is queued. אורי is only asked about one person.

4. אורי taps **כן**. Friday moves to דנה, Sunday evening moves to אורי, other offers cancel, request → `COMMITTED`.  
   נועה: «אורי ודנה החליפו: שישי בבוקר ↔ ראשון בערב»

5. If אורי taps **לא**, דנה is told he refused. The next queued swap becomes the proposed match. If nobody is left → `UNFILLED`.

Swap never commits because a coworker said yes.

---

## Feature 3 — Either (cover or swap, requester does not mind)

אורי will take whichever outcome can finish. Coworkers choose how they help.

### Happy path — someone covers

1. אורי picks Friday morning and taps **כיסוי / החלפה**.  
   Request: `kind=EITHER`, `status=SEEKING`.  
   Chat: «מחפשים פתרון לשישי בבוקר — כיסוי או החלפה.»  
   נועה: «אורי ביקש כיסוי או החלפה · שישי בבוקר · מחפשים»

2. Agent messages everyone off that day.  
   דנה (has Sunday): «אורי צריך פתרון לשישי בבוקר. אפשר לקחת, או להחליף עם ראשון בערב?»  
   Buttons: **כיסוי** / **החלפה** / **לא**  
   יוסי (has Saturday): same, with Saturday morning as the swap.  
   A coworker with no later shift only gets **כן** / **לא** for cover.

3. יוסי taps **כיסוי** while the request is still `SEEKING`.  
   Same commit as Cover: Friday moves to יוסי now. דנה’s offer is cancelled.  
   אורי: «יוסי לוקח את שישי בבוקר. המשמרת ירדה ממך.»  
   He is not asked to confirm. He already said he does not mind.

### Happy path — someone swaps

1. Same start.
2. דנה taps **החלפה**. Request → `MATCH_PROPOSED`.  
   אורי is still asked, because a swap names a specific person and time:  
   «דנה מוכנה להחליף. כך שאתה תעשה ראשון בערב (30 באוג'). האם מאשר?»
3. אורי taps **כן**. The two shifts trade. Leftover offers close. נועה is told.

He must confirm a swap even on Either. He already agreed that a swap is acceptable in general, not that Sunday evening with דנה is the one he wants.

### If a swap is waiting and someone else covers

יוסי must not steal a swap that דנה and אורי are already looking at.

- Incoming **כיסוי** during `MATCH_PROPOSED` → that offer is `QUEUED`.  
  יוסי: «קיבלנו. אם אורי לא יאשר את ההחלפה, נעביר אליך את המשמרת.»
- If אורי **כן** on the swap → queued covers are cancelled («כבר לא צריך»).
- If אורי **לא** on the swap → the next queued **cover commits immediately** (he does not mind). If there is no queued cover, the next queued swap is proposed. Then remaining `PENDING`, then `UNFILLED`.

### If two people answer at once

- Two covers on `SEEKING`: first commit wins.  
- Cover and swap on `SEEKING`: whichever transaction still sees `SEEKING` wins that step (cover commits, or swap proposes). The other becomes taken or queued.  
- Two swaps on `SEEKING`: first becomes `MATCH_PROPOSED`, second is queued.

### If everyone says לא

Request → `UNFILLED`. אורי: «לא נמצא פתרון לשישי בבוקר.» נועה gets the old fallback buttons.

### Cancel

אורי or נועה can stop a search. All open offers close. Anyone still waiting is told it is cancelled.

---

## Side by side

| Step | Cover | Swap | Either |
|---|---|---|---|
| אורי’s tap | כיסוי | החלפה | כיסוי / החלפה |
| Who gets a message | Off that day | Off that day and has an upcoming shift | Off that day |
| What they can tap | Take Friday | Trade for their next shift | Cover, and swap if they have a later shift |
| First coworker cover | **Commit now** | Not offered | **Commit now** |
| First coworker swap | Not offered | Propose to אורי | Propose to אורי |
| אורי confirms | No | Required | Only for a swap |
| Roster write | Friday changes owner | Two shifts trade | Cover or trade, depending on the finish |
| Others get “no longer needed” | Right after the first yes | After אורי confirms | After the finish (cover now, or swap confirm) |
| Cover during a pending swap | — | — | Queued; commits only if אורי refuses the swap |

---

## Demo click-through

### Cover

1. אורי → Friday morning → **כיסוי**.  
2. דנה sees the cover question. יוסי sees it too. נועה’s card is searching.  
3. דנה **כן**.  
4. אורי lost Friday. יוסי is told it is no longer needed. נועה sees דנה covering.

### Swap

1. אורי → Friday morning → **החלפה**.  
2. דנה **כן** on Sunday evening.  
3. אורי **כן** on “switch with דנה”.  
4. They have traded. יוסי is told it is no longer needed. נועה sees the trade.

### Either — cover wins

1. אורי → Friday morning → **כיסוי / החלפה**.  
2. דנה and יוסי see both options.  
3. יוסי taps **כיסוי**.  
4. Friday is his. No second confirm. דנה is told it is no longer needed.

### Either — swap, then a queued cover

1. Same start. דנה taps **החלפה**. אורי is asked.  
2. יוסי taps **כיסוי** and is queued.  
3. If אורי **כן**, the trade happens and יוסי is cancelled.  
4. If אורי **לא**, יוסי gets Friday immediately.

---

## Data the search writes

| Table | What a row means |
|---|---|
| `shift_swap_requests` | One ask. `kind` is `COVER`, `SWAP`, or `EITHER`. Status moves `SEEKING` → `MATCH_PROPOSED` (swap only) → `COMMITTED`. |
| `shift_offers` | One ask to one coworker. `allowCover` / `allowSwap` say what they may tap. After they answer, only the chosen action stays true, so a queued Either swap is not later treated as a cover. |
| `shifts` | Cover changes `employeeId` on Friday. Swap swaps `employeeId` on both rows. The old owner-approve path still deletes the row. |
| `messages` | Requester chat and owner desk. Coworkers see the offer on their home screen. |

---

## What this slice does not build

- Live WhatsApp (same mock / web chat as today)  
- LLM choosing who to message  
- Qualification, hours-cap, or rest-time rules beyond “off that day”  
- Coworker picking a different shift than their next upcoming one  
- Vacancy KPIs, Phase 4 kill switch / budgets  

Those stay later Phase 6 / Phase 4 / Phase 5 work.
