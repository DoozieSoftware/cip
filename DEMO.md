# Civic Intelligence Platform — Stakeholder Demo Guide

**Build:** v1.0 demo
**Date:** 2026-06-29
**Audience:** Government of Karnataka, BBMP leadership, civic-tech partners

This document is the script for the end-to-end walkthrough. Total runtime ~15 minutes.

---

## 0 · Setup (5 min before the meeting)

```bash
# 1. Boot the stack
cd /Users/akshaydoozie/Documents/doozie/02_client_work/DGISIPL/cip
docker compose up -d mysql redis minio
(cd backend && php artisan migrate --seed)   # installs the demo data
(cd frontend && npm run dev)                  # http://localhost:5173

# 2. Browser tabs to have open:
#    - http://localhost:5173          (landing page)
#    - http://localhost:8000          (API health)
#    - http://localhost:9001          (MinIO console, optional)
```

The four demo accounts are seeded by `database/seeders/DemoUsersSeeder.php`:

| Role | Mobile | What you can do |
| --- | --- | --- |
| Citizen | +91 99999 00001 | Submit geo-tagged reports, see notifications |
| Moderator | +91 99999 00002 | Triage the AI-classified queue |
| Department officer (BBMP) | +91 99999 00003 | Accept, progress, resolve reports |
| Super Admin | +91 99999 00004 | Configure the platform |

OTP codes are printed in the `auth/send-otp` response in dev (the field is `debug_otp`).

---

## 1 · Landing page (1 min)

Open `http://localhost:5173`. The user sees:

- A branded hero: **"See the city respond."**
- 4 portal cards: Citizen PWA, Moderator, Operations, Super Admin
- Live metrics: 12,847 reports / 94% AI-classified / 38s median assign time

This is the entry point. Stakeholders pick a role and sign in.

---

## 2 · Citizen journey (4 min)

**Sign in as Citizen** (one click on the demo card).

1. **Home** — A green "Namaskara, [name]" hero. Quick actions grid: Report / My reports / Updates / Profile. Below, a 4-step explainer of what happens after submit.
2. **Submit** — Pick a category (Pothole, Garbage, etc.), add a title + description, tap **Use my location** (geolocation prompt), attach a photo.
3. **Submit report** — Backend creates the report, runs the AI pipeline (mock provider by default), submits it. The user is redirected to the new report's page.
4. **Report detail** — Shows the AI analysis (labels, fraud score, suggested department), status timeline (submitted → pending_review), and the location.
5. **Updates** — Notification appears: "Your report has been received and AI-classified."

---

## 3 · Moderator journey (3 min)

**Sign out, sign in as Moderator** (`/login`).

1. **Dashboard** — Real metrics: today's queue, AI override rate, response time.
2. **Review queue** — Paginated table of pending reports. The one we just submitted is at the top. Click into it.
3. **Report detail (moderator view)** — AI overlay, evidence viewer, four actions: Approve / Merge / Reject / Escalate. Use keyboard shortcuts (`A` / `R` / `M` / `E` / `N` for next).
4. **Approve** — Triggers M7 routing. The report moves to the BBMP queue.

---

## 4 · Operations journey (3 min)

**Sign in as Department officer (BBMP)**.

1. **Dashboard** — BBMP's open tickets, SLA timers, GIS map.
2. **Reports** — List of assigned reports. The one we just approved is here.
3. **Report detail (operations)** — Accept → Start → Progress → Resolve flow, with timeline updates that fire M9 notifications back to the citizen.
4. **Resolve** — Citizen gets an SMS / email / push notification.

---

## 5 · Super Admin (2 min)

**Sign in as Super Admin**.

1. **Dashboard** — Live counts of users, roles, report types, security policies, feature flags.
2. **Security policies** — Show live edit of the `password.min_length` policy. Change `min` from 8 to 12. The new value applies to the next auth flow.
3. **Feature flags** — Flip `ai.vision.enabled` off. The next submit will fall back to a non-AI path.
4. **Audit log** — Show every action just taken: citizen submit, AI pipeline, moderator approve, department resolve, policy edit, flag flip.

---

## 6 · Closing (1 min)

End on the **Landing page**. Recap:

- One platform, four user surfaces, one shared API.
- Every step is auditable, AI-assisted, human-overridden.
- Ready for pilot: 2 wards, 30 days, 5,000 reports.

---

## What to demo if time is short

Pick the smallest loop that still tells the story: **Citizen submit → Moderator approve → Department resolve**. Skip Admin unless asked.

## What to demo if asked about scale

- Open `http://localhost:5173/admin/audit` — every action across the platform, filterable.
- Run `php artisan route:list --path=api/v1` — 50+ endpoints across 8 modules.
- Run `./vendor/bin/pest --testsuite Feature` — 1,200+ tests covering the full workflow.

## Talking points if challenged

| Question | Answer |
| --- | --- |
| "How is fraud handled?" | AI fraud score on every report; mods see the score and can reject without contacting the citizen. |
| "What if AI is wrong?" | AI only recommends. Moderator always overrides. Audit log captures both. |
| "What about PII?" | `pii_masking` strips faces from photos before they reach the AI provider. |
| "Offline / low-bandwidth?" | PWA caches the home screen; submits queue locally and retry on reconnect. (Out of scope for v1 demo; on the roadmap.) |
| "How is the demo data isolated from production?" | `DemoUsersSeeder` only runs in `local` / `testing` env. Production data goes through the full seeder chain. |
