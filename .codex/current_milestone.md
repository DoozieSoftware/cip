# Current Milestone — M17 Closeout (next: M14)

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** **M1–M13 + M17 CLOSED 354/354 = 100 % of in-scope work**; total 354/420 = 84.3 %.
**Last updated:** 2026-07-02 (post-audit remediation: M11 backfilled 28/28 in `.codex` tracking — the module was already fully implemented on `main` but the tracking files never caught up; M17 — Public Transparency Portal — added as new scope and closed 10/10).

> M1 (22/22), M2 (30/30), M3 (24/24), M4 (32/32), M5 (26/26), M6 (22/22), M7 (18/18), M8 (30/30), M9 (20/20), M10 (28/28), M11 (28/28), M12 (34/34), M13 (30/30), and M17 (10/10) are complete. **M13 is the Citizen PWA** — the React 19 SPA at `/citizen` with the bottom-nav shell, 8 pages (Home, Submit, My Reports, Report Detail, Dashboard, Notifications, Profile, Settings), the IndexedDB offline queue (`OfflineQueue` + `MemoryAdapter` + `IndexedDBAdapter` backed by the `idb` peer dep), the service worker (`cip-sw-v2` — shell pre-cache, network-first API, cache-first static, navigation fallback, background-sync broadcast, push handler with `push:received` client message), the `swBridge` (requestBackgroundSync, onQueueDrain, onPushReceived, onPushNavigate), the `subscribeToPush` (FCM-style), the security guardrails (`blockFileInputs`, `evidencePreviewHandlers`, `stripExif`, `scrubFile`, `guardVideoDuration`), the mock-GPS heuristic (now actually wired into the submit flow and the fraud scorer — see the 2026-07-01 remediation note in §11), the design-system additions (`ErrorBoundary`, `ErrorState`, `PageStates`), `docs/citizen.md`, `docs/citizen-security-review.md`, the `scripts/check_bundle_budget.sh` budget gate, README M13 section, and full Vitest (87 / 87) + Playwright (49 total) coverage. **M17 is the Public Transparency Portal** — new scope discovered missing during a 2026-07-01 documentation-vs-reality audit (`docs/02` §7 scoped it; nothing was ever built); see `.codex/roadmap.md` §M17 and `docs/public.md`.

**Source Documents:** `AGENTS.md`, `.codex/roadmap.md` §M13, §M17, `.codex/task_queue.md` §M13, §M17, `docs/06-Citizen-PWA-Specification.md` (entire), `docs/13-UI-Design-System.md` (entire), `docs/15-QA-and-Test-Strategy.md` §7, §9, `docs/public.md`.

---

## 1. Current Milestone

* **Milestone ID:** M17 — **CLOSED** (most recently closed milestone; M13 closed earlier, see §7)
* **Title:** Public Transparency Portal
* **Status:** **10 / 10 = 100 %** — every T-M17-001..T-M17-010 row has the corresponding code, tests, and documentation on the working tree (`docs/public.md`, `backend/app/Modules/Public/`, `frontend/src/portals/public/`). Not part of the original M1–M16 roadmap; see `.codex/roadmap.md` §M17 provenance note.
* **Depends on:** M4, M6, M9.
* **Unblocks:** Nothing downstream is gated on M17. **Next up: M14 — External Connector Framework** (not started).

---

## 2. Objective

Land the Citizen PWA end-to-end. This includes the React 19 SPA shell, the bottom-nav layout, the 8 pages (Home, Submit, My reports, Report detail, Dashboard, Notifications, Profile, Settings), the IndexedDB queue with backoff and dedupe, the service worker (cache + background sync + push), the security guardrails (no file inputs, EXIF scrub, video duration guard, mock-GPS heuristic), the Vitest + Playwright + axe-core coverage, and `docs/citizen.md`. **All of this is now in `origin/main` at `84c55e20`.**

---

## 3. Deliverables (per `.codex/roadmap.md` §M13)

* `frontend/src/portals/citizen/CitizenApp.tsx` — router + lazy pages, wrapped in `ErrorBoundary` (T-M13-001 / T-M13-020).
* `frontend/src/portals/citizen/layout/CitizenLayout.tsx` — bottom-nav + `ToastProvider`.
* `frontend/src/portals/citizen/components/CameraCapture.tsx` — `getUserMedia` + EXIF scrub + 3..5 s video guard. **No `<input type="file">` reachable anywhere in the citizen app** (T-M13-008 / T-M13-019 / T-M13-027).
* `frontend/src/portals/citizen/components/GpsCapture.tsx` — `geolocation` capture with mock-GPS scoring (T-M13-009 / T-M13-018).
* `frontend/src/portals/citizen/components/PageStates.tsx` — loading / error / empty / data render helper (T-M13-020).
* `frontend/src/portals/citizen/components/Toast.tsx` — provider + `useToast()`.
* `frontend/src/portals/citizen/offline/queue.ts` — `OfflineQueue` + `MemoryAdapter` + `IndexedDBAdapter` (`idb` peer dep) (T-M13-006).
* `frontend/src/portals/citizen/offline/swBridge.ts` — `requestBackgroundSync` + `onQueueDrain` + `onPushReceived` + `onPushNavigate` (T-M13-007).
* `frontend/public/sw.js` — `cip-sw-v2`: install, activate, fetch, sync, push, notificationclick.
* `frontend/src/portals/citizen/push/subscribe.ts` — `subscribeToPush` + `unsubscribeFromPush` (T-M13-017).
* `frontend/src/portals/citizen/security/evidenceGuards.ts` — `blockFileInputs`, `evidencePreviewHandlers`, `stripExif`, `scrubFile`, `guardVideoDuration` (T-M13-019 / T-M13-027).
* `frontend/src/portals/citizen/security/mockGps.ts` — `MockGpsResult` heuristic (T-M13-018).
* `frontend/src/portals/moderator/design/ErrorBoundary.tsx` + `ErrorState.tsx` (T-M13-020).
* Vitest coverage (87 / 87 green):
  - `offline/__tests__/queue.test.ts` — 9 (T-M13-026).
  - `offline/__tests__/swBridge.test.ts` — 6.
  - `security/__tests__/evidenceGuards.test.ts` — 7 (T-M13-027).
  - `components/__tests__/PageStates.test.tsx` — 4.
  - `design/__tests__/ErrorBoundary.test.tsx` — 4.
* Playwright coverage (T-M13-021 / T-M13-023 / T-M13-024 / T-M13-025):
  - `e2e/citizen-shell.spec.ts` — 3 tests.
  - `e2e/citizen-a11y.spec.ts` — 8 tests (one per route + the heading/nav gate).
  - `e2e/citizen-offline.spec.ts` — 1 test.
  - `e2e/citizen-offline-submit.spec.ts` — 2 tests.
  - `e2e/citizen-push.spec.ts` — 1 test.
* `scripts/check_bundle_budget.sh` — budget gate (T-M13-022). Largest 537 KB, entry gz 92 KB — green.
* `docs/citizen.md` (T-M13-028).
* `docs/citizen-security-review.md` (T-M13-030) — 9 sections, ✅/⚠ annotations.
* README M13 section (T-M13-029).

---

## 4. Scope (closed)

* **M13 in scope:** the citizen SPA, the offline queue, the service worker, the push subscription, the security guardrails, the docs.
* **M17 in scope:** the read-only `Public` module (stats/heatmap/department-performance services), the three unauthenticated `/public/*` endpoints, the `frontend/src/portals/public/` portal, the landing-page link, `docs/public.md`.
* Out of scope for both: M14 connector framework, M15 security hardening (e.g. anti-fraud reporting to the citizen), M16 production hardening.

---

## 5. Exit Criteria — all met

**M13:**
* All M13 tasks in `.codex/task_queue.md` have the corresponding code path on `main` (T-M13-001..030).
* `npm test` is green (87 / 87 across 21 files at M13 close; 109/109 platform-wide as of the 2026-07-02 verification pass).
* `npm run build` is green.
* `npm run budget` is green (largest 537 KB / entry-gz 92 KB / SW+manifest+icons 8 KB).
* Every new component has Vitest coverage; the PWA shell, SW registration, and settings page have Playwright coverage.
* The service worker registers, pre-caches the shell, and handles `sync` + `push`.
* `docs/citizen.md` and `docs/citizen-security-review.md` describe the queue, the SW strategy, the push contract, the security guardrails, and the test surface.

**M17:**
* All M17 tasks in `.codex/task_queue.md` have the corresponding code path (T-M17-001..010).
* `/public/stats`, `/public/heatmap`, `/public/departments/performance` are reachable with no `Authorization` header and rate-limited to 30 req/min/IP.
* No response from any `/public/*` endpoint contains an un-rounded coordinate, a citizen identifier, or department-internal detail — asserted by `backend/tests/Feature/Public/` (17 tests).
* `docs/public.md` and the README M17 section describe the endpoints, privacy rules, and portal.

---

## 6. Documents to read before implementation

* `AGENTS.md` — coding standards, security rules, RBAC rules.
* `.codex/roadmap.md` §M13, §M17.
* `.codex/task_queue.md` §M13 (T-M13-001 → T-M13-030), §M17 (T-M17-001 → T-M17-010).
* `docs/06-Citizen-PWA-Specification.md` (entire).
* `docs/03-System-Architecture.md` §4 (Citizen PWA context).
* `docs/05-REST-API-Specification.md` §9 (citizen REST surface).
* `docs/11-Security-and-Anti-Fraud-Specification.md` §12 (mock-GPS), §13 (EXIF).
* `docs/13-UI-Design-System.md` (entire).
* `docs/15-QA-and-Test-Strategy.md` §7, §9.
* `docs/public.md` — M17 reference.

---

## 7. Current Implementation Status

* **M1 (Bootstrap):** 22/22 = 100 % — CLOSED.
* **M2 (Authentication):** 30/30 = 100 % — CLOSED.
* **M3 (Master Data):** 24/24 = 100 % — CLOSED.
* **M4 (Reports):** 32/32 = 100 % — CLOSED.
* **M5 (Media):** 26/26 = 100 % — CLOSED.
* **M6 (Workflow):** 22/22 = 100 % — CLOSED.
* **M7 (Routing):** 18/18 = 100 % — CLOSED.
* **M8 (AI Vision):** 30/30 = 100 % — CLOSED.
* **M9 (Notifications):** 20/20 = 100 % — CLOSED.
* **M10 (Moderator Portal):** 28/28 = 100 % — CLOSED.
* **M11 (Operations Portal):** 28/28 = 100 % — CLOSED (backfilled in `.codex` tracking 2026-07-02; the module itself has been on `main` since before M12).
* **M12 (Super Admin Portal):** 34/34 = 100 % — CLOSED.
* **M13 (Citizen PWA):** 30/30 = 100 % — CLOSED (commit `84c55e20`).
* **M14 (External Connector Framework):** 0/24 — NOT STARTED.
* **M15 (Security, Anti-Fraud & Compliance Hardening):** 0/24 — NOT STARTED.
* **M16 (Production Hardening, Observability & Release):** 0/18 — NOT STARTED.
* **M17 (Public Transparency Portal):** 10/10 = 100 % — **CLOSED** (new scope added 2026-07-02; see `.codex/roadmap.md` §M17).
* **Total:** 354 / 420 = 84.3 %.

---

## 8. Blocking Issues

* None. M13 and M17 close every currently-scoped end-user-facing surface. Production launch is unblocked by M14 (connector framework) + M15 (security hardening) + M16 (production hardening).

---

## 9. Next Milestone

* **M14 — External Connector Framework** (`.codex/task_queue.md` §M14, 24 tasks). M14 wires the M12 integrations screen to actual outbound connectors (department systems, SMS gateways, GIS).

## 10. Recent commits (M12 + M13 work)

```
84c55e20 feat(citizen): finish M13 closeout (T-M13-020/021/022/024/030)
b172ecfa docs(scripts): add GitHub Project setup runbook
a0cc2dc6 feat(citizen): finish M13 service worker, push, queue, security guardrails
d69578c0 test(admin): Playwright E2E shell + WCAG AA axe scan (T-M12-029 + T-M12-030)
0b0d5ccd feat(admin): data retention + system config + audit log export test
9f36e293 feat(admin): routing rules + workflow builder UI
7cef58de feat(admin): AI providers + prompts UI (T-M12-021)
8623db6d feat(admin): integrations + storage + notification configs UI
81f345a4 feat(admin): docs/admin.md + platform health + scheduler UI
375b8575 feat: complete M12 remaining CRUD + M13 PWA shell
```

## 11. Post-audit remediation (2026-07-01 → 2026-07-02, uncommitted at time of writing)

A red-team documentation-vs-reality audit on 2026-07-01 (Overall Alignment Score 47/100) drove a 6-phase remediation plan (`plans/session-post-audit-remediation.md`):

1. **AI providers, real and configurable + container-binding fix** — closes the audit's top Critical finding that no report had ever been AI-classified end-to-end (M8).
2. **Staff password authentication** — `POST /api/v1/auth/login` (M2).
3. **DEMO.md + landing page accuracy** — real `/public/stats`-backed numbers (M4).
4. **Citizen offline queue + mock-GPS wiring** — `SubmitPage.tsx` now actually enqueues on network failure and the mock-GPS score reaches the moderator fraud panel (M13).
5. **Public Transparency Portal** — new scope, tracked as **M17** (closed 10/10, see §7).
6. **This `.codex` rebuild** — M11 backfilled from 0 % to 100 % (the module was already real code; only the tracking was stale), M17 added, totals recomputed across `current_milestone.md` / `task_queue.md` / `completed_tasks.md`.

See `.codex/completed_tasks.md` §6 ("Post-Audit Remediation — Phases 1–4") and §6.1 ("M17 Closeout") for full detail. This work is on the working tree but has not yet been committed to `main` as of this update.
