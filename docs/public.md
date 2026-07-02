# Public Transparency Portal (M17)

The Public Transparency Portal is the read-only, unauthenticated
window into aggregate platform activity. Per Vision §7 / PRD M7 and
the Privacy-By-Design principle, it exposes counts, percentages, and
grid-bucketed aggregates only — never a citizen's identity, an exact
coordinate, evidence media, or department-internal notes.

This document describes the M17 REST surface, the privacy rules that
constrain every response, and the React portal at `/public`.

## Pipeline at a glance

```
   Anyone (no auth) visits the Landing page or /public
        │
        ▼
   /public                      ← Overview: totals, AI-classified %, median assign time
        │
   /public/heatmap              ← report density, ~1.1 km grid cells
        │
   /public/departments/performance  ← resolution rate + median resolution time per department
```

The Landing page (`frontend/src/pages/LandingPage.tsx`) also renders
the same three overview numbers and links out to the full portal —
the two surfaces share one backend endpoint (`/public/stats`) and one
5-minute cache entry.

## Why this exists

The original Vision/PRD scoped a public transparency surface for M7;
the audit that preceded this milestone found it had been dropped
somewhere between planning and `.codex` tracking — no module, no
routes, no frontend existed. This module closes that gap.

## REST surface (M17, all unauthenticated, `throttle:public`)

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET    | `/api/v1/public/stats` | `{ total_reports, ai_classified_percent, median_assign_seconds }` |
| GET    | `/api/v1/public/heatmap` | `{ points: [{ lat, lng, count }] }` — grid-bucketed, never exact |
| GET    | `/api/v1/public/departments/performance` | `{ departments: [{ id, name, code, total_reports, resolved_reports, resolution_rate_percent, median_resolution_hours }] }` |

No route in this group sits behind `auth:sanctum`. All three sit
behind the `public` rate limiter — **30 requests/minute per IP**
(`RouteServiceProvider::LIMITER_PUBLIC`) — which is deliberately low
because every response is server-cached for 5 minutes; a legitimate
client never needs to poll faster than that.

## Privacy rules

Every service in `app/Modules/Public/Services/` is read-only and
enforces the same three constraints:

* **No exact coordinates.** `PublicHeatmapService::grid()` rounds
  `latitude`/`longitude` to 2 decimal places (~1.1 km grid cells) —
  the identical rounding precision `PiiMaskingService` already uses
  before a report's location is sent to a third-party AI provider.
  Sparse cells still represent an aggregate of however many reports
  fall in that cell, never a single citizen's submission.
* **No citizen identity, no evidence.** None of the three services
  select `reporter_id`, mobile, name, or media/evidence URLs — the
  underlying queries never join to those columns in the first place,
  so there is nothing to redact.
* **No department-internal detail.** `PublicDepartmentPerformanceService::summary()`
  selects only `name`, `code`, and aggregate counts per department —
  no assigned-officer names, no internal notes, no SLA-breach
  reasoning.

## Service-layer notes

* `PublicStatsService::summary()` — `total_reports` and
  `ai_classified_percent` (`ai_label IS NOT NULL` / total) are plain
  counts. `median_assign_seconds` is the median time between a
  report's `submitted` and `assigned` status-history transitions,
  computed in PHP over the most recent 500 assignments (MySQL 8 has
  no built-in median aggregate) and returns `null` if there isn't
  enough history yet.
* `PublicHeatmapService::grid()` queries `DB::table('reports')->join('locations', ...)`
  directly rather than `Report::query()` — a plain aggregate
  projection (`lat`, `lng`, `count`) has no natural Eloquent-model
  shape, so the raw query builder is the correct tool here, not a
  workaround.
* `PublicDepartmentPerformanceService::summary()` — `resolved` means
  a report's current status is `resolved`, `verified`, or `closed`.
  `median_resolution_hours` is the median of `submitted_at` → first
  resolved-family status-history transition, per department;
  departments with zero reports are omitted from the response rather
  than shown with a misleading `0%`.
* All three services cache their result for 5 minutes under keys
  `public.stats`, `public.heatmap`, `public.department_performance`.

## React portal

`frontend/src/portals/public/` is a small, unauthenticated SPA
mounted at `/public` in `App.tsx` with **no** `ProtectedRoute`
wrapper — unlike every other portal, nobody needs to sign in to see
it. It does not nest its own `<BrowserRouter>` (the pattern every
other portal uses); it relies on the app-level router instead, since
it has no need for portal-local navigation state.

* `PublicApp.tsx` — lazy routes: Overview, Heat map, Department
  performance.
* `layout/PublicLayout.tsx` — nav + a footer disclaimer describing
  the aggregation rules above.
* `pages/OverviewPage.tsx` — the three `/public/stats` numbers.
* `pages/HeatmapPage.tsx` — Leaflet `MapContainer`/`CircleMarker`,
  same library and pattern as the operations portal's
  `GisMapPage.tsx`; marker radius scales with `count / maxCount`.
  (No Vitest unit test exists for this page — Leaflet+jsdom isn't
  exercised anywhere in this codebase, including the pre-existing
  `GisMapPage.tsx`, so this follows established precedent rather than
  introducing a gap.)
* `pages/DepartmentPerformancePage.tsx` — a table (reusing the
  moderator portal's `design/` component set, the way the Admin
  portal already does) plus a CSS bar for resolution rate.
* `api/client.ts` — `usePublicStats`/`usePublicHeatmap`/`usePublicDepartmentPerformance`,
  each a React Query hook with `staleTime: 5 * 60_000` matching the
  backend's cache TTL.

## Tests

* `tests/Feature/Public/PublicStatsEndpointTest.php`
* `tests/Feature/Public/PublicHeatmapEndpointTest.php`
* `tests/Feature/Public/PublicDepartmentPerformanceEndpointTest.php`

  Each suite asserts both aggregation correctness and the privacy
  rules above (no PII field, no un-rounded coordinate, appears in any
  response).
* `frontend/src/pages/__tests__/LandingPage.test.tsx` — asserts the
  landing page links to `/public`.
* `frontend/src/portals/public/pages/__tests__/OverviewPage.test.tsx`
* `frontend/src/portals/public/pages/__tests__/DepartmentPerformancePage.test.tsx`
