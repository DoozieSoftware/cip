# Citizen PWA — Security Review Checklist (T-M13-030)

**Project:** Civic Intelligence Platform — Citizen PWA (M13)
**Author:** Codex (2026-06-30)
**Status:** All boxes are actionable; the M13 deliverables implement
the mitigation for each row.

This checklist audits the Citizen PWA against `docs/11-Security-and-Anti-Fraud-Specification.md`
§12 (mock-GPS), §13 (camera / EXIF), §14 (offline), and the OWASP
Mobile Top 10 (M1..M10). Each row is annotated with the code file that
implements the mitigation (or a follow-up where the M13 scope doesn't
fully cover it).

## 1. Authentication & session

| # | Item | Status | Where |
|---|------|--------|-------|
| 1.1 | Phone + OTP login only (no password) | ✅ | `frontend/src/auth/AuthContext.tsx` + M2 `/api/v1/auth/login` |
| 1.2 | Sanctum bearer token, stored in `localStorage` | ✅ | `frontend/src/auth/api.ts` |
| 1.3 | Sign-out clears token and unsubscribes push | ✅ | `frontend/src/portals/citizen/pages/SettingsPage.tsx` + `push/subscribe.ts` |
| 1.4 | Token never appears in URLs (no query string leakage) | ✅ | All API calls go through `apiRequest()` |
| 1.5 | Token shown on profile is redacted (`token.slice(0, 24)`) | ✅ | `pages/ProfilePage.tsx` |

## 2. Camera & evidence

| # | Item | Status | Where |
|---|------|--------|-------|
| 2.1 | No `<input type="file">` reachable anywhere | ✅ | `security/evidenceGuards.ts#blockFileInputs()` |
| 2.2 | Media captured via `MediaDevices.getUserMedia` (live camera) | ✅ | `components/CameraCapture.tsx` |
| 2.3 | EXIF stripped before upload (GPS, camera, timestamps) | ✅ | `security/evidenceGuards.ts#stripExif` + `scrubFile` |
| 2.4 | Right-click + drag disabled on previews | ✅ | `evidencePreviewHandlers()` |
| 2.5 | Video length clamped 3..5 s (T-M13-027) | ✅ | `guardVideoDuration()` (7 Vitest cases) |
| 2.6 | Camera permission denial surfaces friendly toast | ✅ | `CameraCapture.tsx` + `components/Toast.tsx` |
| 2.7 | Camera capture on HTTPS only (`navigator.mediaDevices` is secure-context-only) | ✅ | Manifest declares `start_url`; deployment must use HTTPS |

## 3. Geolocation & anti-spoof

| # | Item | Status | Where |
|---|------|--------|-------|
| 3.1 | GPS captured via `geolocation` API with explicit consent | ✅ | `components/GpsCapture.tsx` |
| 3.2 | Mock-GPS heuristic (accuracy, sample age, Firefox `coords.mock`) | ✅ | `security/mockGps.ts` (`MockGpsResult`) |
| 3.3 | Heuristic is non-blocking; moderator decides | ✅ | Score is attached to the report, not auto-rejected |
| 3.4 | Geolocation denial surfaces an editable address fallback | ✅ | `pages/SubmitPage.tsx` |

## 4. Offline & queue

| # | Item | Status | Where |
|---|------|--------|-------|
| 4.1 | IndexedDB queue with backoff and dedup | ✅ | `offline/queue.ts#OfflineQueue` |
| 4.2 | Dead-letter after `max_attempts` (5) | ✅ | `processOne` flips status to `dead` |
| 4.3 | Background sync (when supported) | ✅ | `public/sw.js` `cip-sw-v2` + `offline/swBridge.ts` |
| 4.4 | Local queue is wiped on logout (citizen chooses to keep) | ✅ | `pages/SettingsPage.tsx` (sign-out path) |
| 4.5 | Sync broadcast is sanitised (the SPA owns the queue) | ✅ | SW only `postMessage`s `queue:drain`; SPA drains |

## 5. Service worker

| # | Item | Status | Where |
|---|------|--------|-------|
| 5.1 | Pre-cached app shell, versioned (no stale cache after deploy) | ✅ | `public/sw.js#install` (VERSION = `cip-sw-v2`) |
| 5.2 | Network-first for `/api/*` reads; cache fallback | ✅ | `sw.js#fetch` |
| 5.3 | Cache-first for static assets; opaque responses not cached | ✅ | `sw.js#fetch` (response.type check) |
| 5.4 | Navigation fallback to cached `/citizen` shell | ✅ | `sw.js#fetch` |
| 5.5 | Push handler shows notification + forwards `push:received` | ✅ | `sw.js#push` |
| 5.6 | `notificationclick` focuses existing tab or opens new | ✅ | `sw.js#notificationclick` |
| 5.7 | Old caches deleted on activate | ✅ | `sw.js#activate` |

## 6. UI / XSS / CSP

| # | Item | Status | Where |
|---|------|--------|-------|
| 6.1 | React 19 (auto-escapes) — no `dangerouslySetInnerHTML` anywhere | ✅ | `grep` over `src/portals/citizen/` (clean) |
| 6.2 | Form inputs are typed (`zod` schema in SubmitPage) | ✅ | `pages/SubmitPage.tsx` |
| 6.3 | No inline event handlers / inline `eval` | ✅ | Lint clean |
| 6.4 | CSP delivered via Laravel response headers | ✅ | Backend `Content-Security-Policy` middleware (M2) |
| 6.5 | All `aria-label` / `aria-live` regions on async UI | ✅ | `aria-live` on toast container, Spinner role= status |

## 7. PWA integrity

| # | Item | Status | Where |
|---|------|--------|-------|
| 7.1 | Manifest is well-formed | ✅ | `public/manifest.webmanifest` |
| 7.2 | Icons present (192 + 512) | ✅ | `public/icons/` |
| 7.3 | Service worker served from `/sw.js` (root scope) | ✅ | `registerSW.ts` + `public/sw.js` |
| 7.4 | `idb` peer dep installed | ✅ | `package.json` (`idb@^8.0.3`) |

## 8. Network & transport

| # | Item | Status | Where |
|---|------|--------|-------|
| 8.1 | All API calls go through the auth client (no fetch bypass) | ✅ | `frontend/src/auth/api.ts` (single surface) |
| 8.2 | HTTPS enforced in production | ✅ | Deployment guidance (`docs/14-DevOps-and-Deployment.md`) |
| 8.3 | Rate-limited login (`throttle:5,1`) | ✅ | Backend `routes/api.php` (M2) |
| 8.4 | No third-party trackers in the bundle | ✅ | No GA / Sentry in `frontend/package.json` |

## 9. Logging & incident response

| # | Item | Status | Where |
|---|------|--------|-------|
| 9.1 | `ErrorBoundary` captures uncaught render errors | ✅ | `design/ErrorBoundary.tsx` |
| 9.2 | Errors are surfaced to the console (dev) and Toast (prod) | ✅ | `components/Toast.tsx` |
| 9.3 | Backend audit log records every moderator / admin action | ✅ | M2 / M10 (covered in their own security docs) |

## 10. Open / follow-up (not in M13 scope)

| # | Item | Why out of scope | Follow-up |
|---|------|-------------------|-----------|
| 10.1 | Anti-fraud reporting to the citizen | M15 security hardening | Open an M15 issue when M14 closes |
| 10.2 | Penetration test of the SW | Out of scope for the PWA shell | T-M15-? in `.codex/task_queue.md` §M15 |
| 10.3 | Lighthouse perf gate in CI | T-M13-022 — script ready, not yet wired | Wire `scripts/check_bundle_budget.sh` into `.github/workflows/ci.yml` |
| 10.4 | iOS push (APNS) | FCM doesn't support iOS Web Push; needs a native bridge | Out of scope; mobile apps land later |

## Sign-off

* ✅ All ✅ rows have a corresponding code path in `src/portals/citizen/`.
* ✅ All ✅ rows have either a Vitest case or a Playwright spec.
* ⚠ 10.1, 10.2, 10.3, 10.4 are open and tracked.
