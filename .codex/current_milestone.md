# Current Milestone — M12/M13 Closeout

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** **M1–M12 CLOSED 286/286 = 100 %**; total 286/410 = 69.8 % (M13 in progress).
**Last updated:** 2026-06-30 (M12 34/34 + M13 scaffold + service worker + docs).

> M1 (22/22), M2 (30/30), M3 (24/24), M4 (32/32), M5 (26/26), M6 (22/22), M7 (18/18), M8 (30/30), M9 (20/20), M10 (28/28), M11 (N/A pre-existing), and M12 (34/34) are complete. **M12 is the Super Admin Portal & Platform Configuration** — every backend CRUD endpoint under `/api/v1/admin/*` (users, roles, permissions, report types, workflows, routing rules, AI providers + prompts, integrations, storage, notification configs, security policies, feature flags, scheduler, organizations, audit log search, platform health, data retention, system config), the full React 19 admin portal at `frontend/src/portals/admin/` (17 pages), `docs/admin.md`, and Playwright + axe-core coverage. **M13 is the Citizen PWA** — `/citizen` SPA with the bottom-nav shell, Camera + GPS + Submit + My Reports + Report Detail + Notifications + Profile + Dashboard + Settings pages, the IndexedDB offline queue (`MemoryAdapter` + `IndexedDBAdapter` with the `idb` peer dep), the service worker (`cip-sw-v2` — shell pre-cache, network-first API, cache-first static, navigation fallback, background-sync broadcast, push handler), the `swBridge` (requestBackgroundSync, onQueueDrain, onPushReceived, onPushNavigate), the `subscribeToPush` (FCM-style), the security guardrails (`blockFileInputs`, `evidencePreviewHandlers`, `stripExif`, `scrubFile`, `guardVideoDuration`), the mock-GPS heuristic, `docs/citizen.md`, and Vitest + Playwright coverage.

**Source Documents:** `AGENTS.md`, `.codex/roadmap.md` §M12 / §M13, `.codex/task_queue.md` §M12 / §M13, `docs/09-Super-Admin-Portal-Specification.md` (entire), `docs/06-Citizen-PWA-Specification.md` (entire), `docs/13-UI-Design-System.md` (entire), `docs/15-QA-and-Test-Strategy.md` §7, §9.

---

## 1. Current Milestone

* **Milestone ID:** M13 (in progress; M12 closed)
* **Title:** Citizen PWA
* **Estimated complexity:** High (PWA + offline + push + camera + GPS + a11y).
* **Estimated duration:** 2 weeks
* **Total tasks:** see `.codex/task_queue.md` §M13 (30 tasks)
* **Status:** **IN PROGRESS** — scaffold, queue, SW, push, security guardrails, docs are in. Open: `idb` runtime is wired (T-M13-026 ✓, 027 ✓), Playwright E2E shells (T-M13-023/024/025 ✓), a11y audit + Lighthouse (T-M13-021 / 022 — pending), and a deeper offline submission E2E (T-M13-024 — current spec is structural).
* **Depends on:** M1 (buildable repo, base `Shared` utilities), M2 (auth + RBAC + `Citizen` role), M4 (Report + media), M5 (signed media URLs), M8 (AI feedback to the citizen), M9 (push channel + `/notifications/push/subscriptions`).
* **Unblocks:** Production launch.

---

## 2. Objective

Land the Citizen PWA end-to-end. This includes the React 19 SPA shell, the bottom-nav layout, the 8 pages (Home, Submit, My reports, Report detail, Dashboard, Notifications, Profile, Settings), the IndexedDB queue with backoff and dedupe, the service worker (cache + background sync + push), the security guardrails (no file inputs, EXIF scrub, video duration guard, mock-GPS heuristic), the Vitest + Playwright + axe-core coverage, and `docs/citizen.md`.

---

## 3. Deliverables (per `.codex/roadmap.md` §M13)

* `frontend/src/portals/citizen/CitizenApp.tsx` — router + lazy pages.
* `frontend/src/portals/citizen/layout/CitizenLayout.tsx` — bottom-nav + ToastProvider.
* `frontend/src/portals/citizen/components/CameraCapture.tsx` — `getUserMedia` + EXIF scrub + 3..5 s video guard.
* `frontend/src/portals/citizen/components/GpsCapture.tsx` — `geolocation` capture with mock-GPS scoring.
* `frontend/src/portals/citizen/offline/queue.ts` — `OfflineQueue` + `MemoryAdapter` + `IndexedDBAdapter` (`idb` peer dep).
* `frontend/src/portals/citizen/offline/swBridge.ts` — `requestBackgroundSync` + `onQueueDrain` + `onPushReceived` + `onPushNavigate`.
* `frontend/public/sw.js` — `cip-sw-v2`: install, activate, fetch, sync, push, notificationclick.
* `frontend/src/portals/citizen/push/subscribe.ts` — `subscribeToPush` + `unsubscribeFromPush`.
* `frontend/src/portals/citizen/security/evidenceGuards.ts` — `blockFileInputs`, `evidencePreviewHandlers`, `stripExif`, `scrubFile`, `guardVideoDuration`.
* `frontend/src/portals/citizen/security/mockGps.ts` — `MockGpsResult` heuristic.
* Vitest coverage: `offline/__tests__/queue.test.ts` (9), `offline/__tests__/swBridge.test.ts` (6), `security/__tests__/evidenceGuards.test.ts` (7).
* Playwright coverage: `e2e/citizen-shell.spec.ts` (T-M13-023), `e2e/citizen-offline.spec.ts` (T-M13-024), `e2e/citizen-push.spec.ts` (T-M13-025).
* `docs/citizen.md` — implementation-level reference.

---

## 4. Scope (current milestone)

* In scope: the citizen SPA, the offline queue, the service worker, the push subscription, the security guardrails, the docs.
* Out of scope: M14 connector framework, M15 security hardening (e.g. anti-fraud reporting to the citizen), M16 production hardening (Lighthouse, e2e load tests).

---

## 5. Exit Criteria

* All M13 tasks in `.codex/task_queue.md` marked `Done`.
* `npm test` is green (79 tests across the citizen + admin + moderator + operations portals).
* `npm run build` is green.
* Every new component has Vitest coverage; the PWA shell, SW registration, and settings page have Playwright coverage.
* The service worker registers, pre-caches the shell, and handles `sync` + `push`.
* `docs/citizen.md` describes the queue, the SW strategy, the push contract, and the security guardrails.

---

## 6. Documents to read before implementation

* `AGENTS.md` — coding standards, security rules, RBAC rules.
* `.codex/roadmap.md` §M13.
* `.codex/task_queue.md` §M13 (T-M13-001 → T-M13-030).
* `docs/06-Citizen-PWA-Specification.md` (entire).
* `docs/03-System-Architecture.md` §4 (Citizen PWA context).
* `docs/05-REST-API-Specification.md` §9 (citizen REST surface).
* `docs/11-Security-and-Anti-Fraud-Specification.md` §12 (mock-GPS), §13 (EXIF).
* `docs/13-UI-Design-System.md` (entire).
* `docs/15-QA-and-Test-Strategy.md` §7, §9.

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
* **M11 (Operations Portal):** already closed in earlier sprints (not in this branch's queue tracking).
* **M12 (Super Admin Portal):** 34/34 = 100 % — **CLOSED** (all 34 tasks done; backend + 17 React pages + docs/admin.md + Playwright + axe-core).
* **M13 (Citizen PWA):** ~16/30 ≈ 53 % — scaffold, queue, SW, push, security, docs are in; E2E shells in; remaining: a11y audit, Lighthouse, full submission E2E, deeper offline push E2E.
* **Total:** 286/410 = 69.8 %.

---

## 8. Blocking Issues

* None. M12 closes the last config consumer the citizen app needed. The IndexedDB adapter is now backed by the `idb` peer dep (`idb@^8.0.3` in `frontend/package.json`).

---

## 9. Next Milestone

* **M14 — External Connector Framework** (`.codex/task_queue.md` §M14). M14 wires the M12 integrations screen to actual outbound connectors (department systems, SMS gateways, GIS).

## 10. Recent commits (M12 + M13 work)

```
d69578c0 test(admin): Playwright E2E shell + WCAG AA axe scan (T-M12-029 + T-M12-030)
0b0d5ccd feat(admin): data retention + system config + audit log export test
9f36e293 feat(admin): routing rules + workflow builder UI
7cef58de feat(admin): AI providers + prompts UI (T-M12-021)
8623db6d feat(admin): integrations + storage + notification configs UI
81f345a4 feat(admin): docs/admin.md + platform health + scheduler UI
375b8575 feat: complete M12 remaining CRUD + M13 PWA shell
```
