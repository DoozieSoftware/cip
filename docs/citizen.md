# Citizen PWA (M13)

The Citizen PWA is the citizen-facing surface of the Civic Intelligence
Platform. It is a React 19 SPA that can be installed on a phone, works
offline, and lets a citizen submit a geo-tagged report (photo or short
video + GPS + category + description) without needing a native app.

This document describes the production wiring: the page tree, the
authentication flow, the IndexedDB offline queue, the service worker,
the push subscription, the security guardrails, and the Vitest +
Playwright coverage.

## Pipeline at a glance

```
   citizen opens /citizen
        │
        ▼
   /api/v1/auth/login + /auth/verify-otp          (Sanctum, M2)
        │
        ▼
   /api/v1/categories  /api/v1/reports  /api/v1/notifications
        │
   submit ─── online  ──► POST /api/v1/reports  (M4)
            ── offline ──► IndexedDB queue (T-M13-006)
                          │
                          └── background sync drains the queue
                              when connectivity is back (T-M13-007)
        │
        ▼
   /api/v1/notifications/push/subscriptions        (M9 push channel)
        │
        ▼
   showNotification  (service worker, T-M13-025)
        │
        ▼
   client.postMessage('push:received')  →  in-app inbox refresh
```

## Page tree

```
/citizen
  ├── /                       → home (quick CTA, recent reports)
  ├── /submit                 → category → camera → GPS → submit
  ├── /reports                → my reports list
  ├── /reports/:id            → report detail + timeline
  ├── /dashboard              → 3 most-recent reports + queue size
  ├── /notifications          → notification inbox
  ├── /profile                → profile (read-only — server is source of truth)
  └── /settings               → push toggle, sign out
```

The route tree lives in `frontend/src/portals/citizen/CitizenApp.tsx`.

## Authentication

* The citizen signs in with phone + OTP (`/api/v1/auth/login`,
  `/api/v1/auth/verify-otp`). The M2 layer issues a Sanctum token.
* The token is stored in `localStorage` and attached to every
  `apiRequest` call from `src/auth/api.ts`.
* The `AuthContext` exposes `{ user, login, logout }` to the React
  tree. `ProtectedRoute` gates the citizen routes in `src/App.tsx`.
* On logout the SPA unsubscribes from push and clears the local
  IndexedDB queue.

## Offline queue (T-M13-006)

* Lives in `src/portals/citizen/offline/queue.ts`.
* The `OfflineQueue` class is pure: it has an `adapter` (one of
  `MemoryAdapter` for tests, `IndexedDBAdapter` for the browser)
  and a `retry` callback that the SPA wires to `apiRequest`.
* Items are deduped by UUID. Each item tracks `attempts`,
  `next_attempt_at`, `status` (`pending` / `in_flight` / `failed` /
  `dead` / `done`).
* Backoff is exponential with jitter: 1s, 2s, 4s, 8s, 16s, capped
  at 5 minutes. After `max_attempts` (default 5) the item flips
  to `dead` and surfaces in the UI for the citizen to edit / delete.
* The `getQueue()` helper is a browser-only singleton that
  instantiates `IndexedDBAdapter` (using the `idb` peer dep). In
  tests and SSR it falls back to `MemoryAdapter`.

## Service worker (T-M13-007)

* Served from `frontend/public/sw.js`, version `cip-sw-v2`.
* **Install:** pre-caches the app shell (`/`, `/citizen`,
  `/citizen/login`, manifest, icons).
* **Activate:** drops any old caches (anything not prefixed with
  the current version).
* **Fetch (GET):**
  - `/api/*` — network-first, falls back to the runtime cache,
    returns a 503 OFFLINE envelope if nothing is cached.
  - static assets (`*.js`, `*.css`, `*.woff2`, images, maps) —
    cache-first, falls back to the network, then a 504.
  - navigation — network-first, falls back to the cached
    `/citizen` shell, then a minimal offline HTML page.
* **Sync:** the SW listens for the `cip-queue-drain` tag and
  broadcasts `queue:drain` to every open client so the SPA
  drains its IndexedDB queue. The SPA can request a sync via
  `requestBackgroundSync()` in `offline/swBridge.ts`.
* **Push:** the SW receives the JSON payload, shows a system
  `Notification`, and broadcasts `push:received` to clients
  for the in-app inbox to refresh. On `notificationclick` it
  focuses the matching tab and posts a `push:navigate` message.
* Opaque cross-origin responses are never cached (they would
  explode the runtime cache).

## Push subscription (T-M13-017)

* `src/portals/citizen/push/subscribe.ts` wraps the
  `PushManager.subscribe(...)` API and posts the resulting
  `PushSubscription` JSON to `/api/v1/notifications/push/subscriptions`.
* On failure (no `idb`, permission denied, persist failed) the
  helper returns a structured `SubscribeResult` the SPA surfaces
  in a toast.
* `unsubscribeFromPush()` is called on logout.

## Security guardrails (T-M13-019)

* `src/portals/citizen/security/evidenceGuards.ts` exposes
  `blockFileInputs()` (no file pickers, only live camera),
  `evidencePreviewHandlers()` (right-click + drag blocked),
  `stripExif(buffer)` (zeroes GPS + camera EXIF tags from
  JPEGs), `scrubFile(file)` (the convenience wrapper used
  by `CameraCapture`), and `guardVideoDuration(durationMs, min, max)`
  (the pure 3..5 s video-window check, T-M13-027).
* The `CameraCapture` component uses `MediaDevices.getUserMedia`
  (no `<input type="file">` is rendered anywhere in the citizen
  app — see `blockFileInputs`).

## Mock-GPS detection (T-M13-018)

* `src/portals/citizen/security/mockGps.ts` is a heuristic
  stack: accuracy, sample age, Firefox `coords.mock` hint,
  altitude. It returns a `MockGpsResult` with a `score` and
  `reasons[]`. The platform never auto-rejects a report on
  mock-GPS alone; the score is stored on the report and the
  moderator portal uses it to triage.

## Tests

* Vitest:
  - `offline/__tests__/queue.test.ts` — 9 tests (enqueue, dedupe,
    backoff, dead flag, drain).
  - `offline/__tests__/swBridge.test.ts` — 6 tests
    (requestBackgroundSync, onQueueDrain, onPushReceived,
    onPushNavigate, unsubscribe).
  - `security/__tests__/evidenceGuards.test.ts` — 7 tests
    (T-M13-027 video duration guard, EXIF no-op, drag handler).
* Playwright:
  - `e2e/citizen-shell.spec.ts` — T-M13-023 (shell + WCAG AA).
  - `e2e/citizen-offline.spec.ts` — T-M13-024 (SW registers).
  - `e2e/citizen-push.spec.ts` — T-M13-025 (settings page).

## Source map

| Concern              | Path                                                    |
|----------------------|---------------------------------------------------------|
| App shell            | `frontend/src/portals/citizen/CitizenApp.tsx`           |
| Layout + bottom nav  | `frontend/src/portals/citizen/layout/CitizenLayout.tsx` |
| Camera               | `frontend/src/portals/citizen/components/CameraCapture.tsx` |
| GPS                  | `frontend/src/portals/citizen/components/GpsCapture.tsx` |
| Offline queue        | `frontend/src/portals/citizen/offline/queue.ts`         |
| SW bridge            | `frontend/src/portals/citizen/offline/swBridge.ts`      |
| Push                 | `frontend/src/portals/citizen/push/subscribe.ts`        |
| Security             | `frontend/src/portals/citizen/security/evidenceGuards.ts` |
| Mock-GPS             | `frontend/src/portals/citizen/security/mockGps.ts`      |
| Service worker       | `frontend/public/sw.js`                                 |
| Manifest             | `frontend/public/manifest.webmanifest`                  |
| Vitest               | `frontend/src/portals/citizen/**/__tests__/*`           |
| Playwright           | `frontend/e2e/citizen-*.spec.ts`                        |
| Spec                 | `docs/06-Citizen-PWA-Specification.md`                  |
| Roadmap              | `.codex/roadmap.md` §M13                                |
| Task queue           | `.codex/task_queue.md` §M13                             |
