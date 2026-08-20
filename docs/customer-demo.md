# Phase 3 — simple talking guide

Open [http://localhost:5173](http://localhost:5173) and click **הרצת הדגמה חיה**.  
Read the screen from top to bottom. Say the lines below.

---

## What this phase is, in regular words

Phases 1 and 2 proved the house exists: the system is on, two businesses can log in, and one cannot see the other.

Phase 3 answers a different question:

**If something goes wrong in the middle of work, does the job disappear?**

When a real customer later writes on WhatsApp “swap my shift” or “order milk”, the system must not lose that request, must not do it twice, and must not fail quietly. Phase 3 is that safety net. There is still no live AI agent and no real WhatsApp.

Think of a restaurant ticket:

1. The order is written down. That is the incoming message.
2. The ticket goes to the kitchen. That is the job queue.
3. If the kitchen drops the ticket, it does not vanish. It sits in a visible “failed” pile with a reason.
4. A manager can send it back to the kitchen, and that action is written down.

That is all Phase 3 is.

---

## What is new vs what you already showed

Already shown (phases 1–2):

- The system is running.
- Two businesses log in separately.
- A WhatsApp-style message creates one task and one reply.
- The same message twice still makes one task.
- Business A cannot see or change Business B.
- The internal team cannot open a back door without a written reason.

New in this phase (steps 8–10):

- Every finished task leaves a paper trail: one event, then it was sent to the workers.
- We deliberately break a task. It does not disappear. You can see it and read why it failed.
- The team can retry that task, only with a written reason, and that retry is recorded.

---

## What to say on each step

**1. The system is alive**  
You see the server and the database answer.  
Say: “Before AI, we prove there is a real system running.”

**2. Two businesses log in**  
Business A and Business B each get their own login.  
Say: “This is a platform. Each of your customers is a separate business.”

**3. A WhatsApp message**  
The customer writes «צריך החלפת משמרת». The system answers «הבקשה התקבלה».  
Say: “This is how every action will start. A message comes in, one task is created, there is a reply, and it is recorded.”

**4. The same message again**  
The same message arrives a second time. Still one task.  
Say: “WhatsApp sometimes sends twice. Without this you would get a double shift, a double order, or a double payment.”

**5. One business cannot see another**  
Business A sees only itself. Business B is blocked.  
Say: “This is the condition for selling to more than one customer.”

**6. One business cannot change another**  
Business B cannot touch A’s task. A stakeholder can look, not change.  
Say: “Hiding data is not enough. A forbidden action is also blocked.”

**7. No quiet back door**  
The business owner cannot open staff access. Operations must write a reason.  
Say: “When we step in to help, it is not silent.”

**8. Every change leaves one trail** *(new)*  
The finished task is saved as one event and sent to the workers.  
Say: “Nothing changes in the database without a trace. That is how we do not lose work.”

**9. A failure stays visible** *(new)*  
We send a task that fails on purpose. It goes into a holding area.  
Say: “A failure does not vanish. We can see it, read the reason, and decide what to do.”

**10. We can retry it, on the record** *(new)*  
Operations retries it with a written reason. The task continues.  
Say: “There is no silent fix. There is an approval, a reason, and a record.”

---

## Why this phase exists

Later the system will actually swap shifts, open maintenance tickets, and order supplies. Those are real actions in a real business.

If a request can get lost, run twice, or fail with nobody noticing, we cannot put an agent on WhatsApp.

This phase is the rule: **one request, one handling, one business, a visible failure, a recorded retry.**

Next phases build on this: real WhatsApp, the shift agent, the caretaker agent, procurement, and the real owner screens.

---

## Close the meeting with this

We showed the foundation and the safety net.  
One request. One reply. One business. A failure you can see. A retry you can explain.  
The rest of the product sits on that.
