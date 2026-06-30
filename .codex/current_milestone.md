# Current Milestone — M13 Closeout

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** **M1–M13 CLOSED 316/316 = 100 %**; total 316/410 = 77.1 %.
**Last updated:** 2026-06-30 (M13 30/30 closed; commit `84c55e20`).

> M1 (22/22), M2 (30/30), M3 (24/24), M4 (32/32), M5 (26/26), M6 (22/22), M7 (18/18), M8 (30/30), M9 (20/20), M10 (28/28), M11 (28/28), M12 (34/34), and M13 (30/30) are complete. **M13 is the Citizen PWA** — the React 19 SPA at `/citizen` with the bottom-nav shell, 8 pages (Home, Submit, My Reports, Report Detail, Dashboard, Notifications, Profile, Settings), the IndexedDB offline queue (`OfflineQueue` + `MemoryAdapter` + `IndexedDBAdapter` backed by the `idb` peer dep), the service worker (`cip-sw-v2` — shell pre-cache, network-first API, cache-first static, navigation fallback, background-sync broadcast, push handler with `push:received` client message), the `swBridge` (requestBackgroundSync, onQueueDrain, onPushReceived, onPushNavigate), the `subscribeToPush` (FCM-style), the security guardrails (`blockFileInputs`, `evidencePreviewHandlers`, `stripExif`, `scrubFile`, `guardVideoDuration`), the mock-GPS heuristic, the design-system additions (`ErrorBoundary`, `ErrorState`, `PageStates`), `docs/citizen.md`, `docs/citizen-security-review.md`, the `scripts/check_bundle_budget.sh` budget gate, README M13 section, and full Vitest (87 / 87) + Playwright (49 total) coverage.

**Source Documents:** `AGENTS.md`, `.codex/roadmap.md` §M13, `.codex/task_queue.md` §M13, `docs/06-Citizen-PWA-Specification.md` (entire), `docs/13-UI-Design-System.md` (entire), `docs/15-QA-and-Test-Strategy.md` §7, §9.

---

## 1. Current Milestone

* **Milestone ID:** M13 — **CLOSED**
* **Title:** Citizen PWA
* **Status:** **30 / 30 = 100 %** — every T-M13-001..T-M13-030 row has the corresponding code, tests, and (where applicable) documentation on `main`.
* **Depends on:** M1, M2, M4, M5, M8, M9.
* **Unblocks:** Production launch.

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

* In scope: the citizen SPA, the offline queue, the service worker, the push subscription, the security guardrails, the docs.
* Out of scope: M14 connector framework, M15 security hardening (e.g. anti-fraud reporting to the citizen), M16 production hardening.

---

## 5. Exit Criteria — all met

* All M13 tasks in `.codex/task_queue.md` have the corresponding code path on `main` (T-M13-001..030).
* `npm test` is green (87 / 87 across 21 files).
* `npm run build` is green.
* `npm run budget` is green (largest 537 KB / entry-gz 92 KB / SW+manifest+icons 8 KB).
* Every new component has Vitest coverage; the PWA shell, SW registration, and settings page have Playwright coverage.
* The service worker registers, pre-caches the shell, and handles `sync` + `push`.
* `docs/citizen.md` and `docs/citizen-security-review.md` describe the queue, the SW strategy, the push contract, the security guardrails, and the test surface.

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
* **M11 (Operations Portal):** 28/28 = 100 % — CLOSED.
* **M12 (Super Admin Portal):** 34/34 = 100 % — CLOSED.
* **M13 (Citizen PWA):** 30/30 = 100 % — **CLOSED** (commit `84c55e20`).
* **Total:** 316 / 410 = 77.1 %.

---

## 8. Blocking Issues

* None. M13 closes the last end-user surface. Production launch is unblocked by M14 (connector framework) + M15 (security hardening) + M16 (production hardening).

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
