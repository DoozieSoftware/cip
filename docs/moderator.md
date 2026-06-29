# Moderator Portal (M10)

The Moderator Portal is the human-in-the-loop layer that sits between the
M8 AI vision pipeline and the M7 routing engine. Per `docs/07` §2 it
exists to ensure that only valid, properly classified, non-fraudulent
reports reach government departments; the AI recommends, the moderator
decides.

This document describes the production wiring: the M10 REST surface, the
service-layer decisions, the audit trail, the workflow transitions, the
React portal, and the keyboard shortcuts.

## Pipeline at a glance

```
   AI completes (M8)
        │
        ▼
   ai_processing → pending_moderator
        │
        ▼
   /api/v1/moderator/queue            ← queue page polls 15 s
        │
   moderator review  ──── approve ─────► assigned  (M7 routes it)
                    ──── reject  ─────► rejected   (terminal)
                    ──── merge   ─────► merged     (terminal, dedup)
                    ──── escalate ────► escalated  (senior queue)
        │
        ▼
   audit_logs + report_status_history rows written
        │
        ▼
   ReportModerated / ReportsMerged events → M9 notifications fan-out
```

## Roles

The portal is gated to the `moderator` role; `super_admin` and `system`
inherit the bypass for testability and emergency access. Citizens,
department officers, and unauthenticated callers are denied at the
Policy layer (`ModerationPolicy`).

| Role | Queue | Review | Merge | Reject | Escalate | Reassign | Analytics |
| ---- | ----- | ------ | ----- | ------ | -------- | -------- | --------- |
| moderator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| super_admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| system | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| citizen | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| department officer | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

## REST surface

All endpoints live under `/api/v1/moderator/` and require the Sanctum
bearer token of an authenticated moderator.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/queue` | Paginated, filterable review queue. |
| GET    | `/duplicates` | Reports with `duplicate_score > 60`. |
| GET    | `/fraud` | Reports with `fraud_score > 60`. |
| GET    | `/reports/{id}` | Full report + AI overlay + media + audit. |
| POST   | `/reports/{id}/review` | Apply a decision: `approve | reject | merge | escalate`. |
| POST   | `/reports/{id}/merge` | Bulk-fold duplicates into a canonical report. |
| POST   | `/reports/{id}/reject` | Reject with a reason code (terminal). |
| POST   | `/reports/{id}/escalate` | Move to the senior queue with a reason. |
| GET    | `/analytics/summary` | Today's counts + AI accuracy. |
| GET    | `/analytics/ai-performance?window=7d` | Per-provider override rate. |

The full OpenAPI surface is in `backend/storage/api-docs/openapi.yaml`
under the `Moderation` tag; the contract test is at
`backend/tests/Feature/Moderation/OpenApiModerationTest.php`.

## Service-layer decisions

`ModerationService` is the only mutator of moderation state. It always:

1. Loads the current `Report` + `WorkflowState` via the M6 `WorkflowEngine`.
2. Calls `engine->evaluate($report, $event, $actor)` to get a `WorkflowDecision`.
3. If the decision is allowed, calls `engine->apply()` to transition + persist.
4. Writes a row to `audit_logs` with action `report.moderated` (or `report.merged`).
5. Dispatches `ReportModerated` (or `ReportsMerged`) for the M9 notification
   listeners to fan out the citizen + department notifications.

Manual overrides (`category_id`, `department_id`, `override_ai=true`)
write the before/after diff into the audit payload so the M12 Super Admin
audit viewer can show what the moderator changed.

## Workflow additions (M6)

Two new states and three new transitions extend the M6 `civic_default`
workflow for the moderation surface:

| State | Terminal? | Color |
| ----- | --------- | ----- |
| `merged` | yes | `#7B1FA2` |
| `escalated` | no | `#E91E63` |

| From | Event | To | Role | SLA |
| ---- | ----- | -- | ---- | --- |
| `pending_moderator` | `approve` | `assigned` | moderator | 120 m |
| `pending_moderator` | `merge` | `merged` | moderator | — |
| `pending_moderator` | `escalate` | `escalated` | moderator | — |

The default `civic_default` workflow now has 13 states and 17 transitions.
The seeder is idempotent (`updateOrCreate` on `code`); the traversal test
in `tests/Feature/Workflow/DefaultWorkflowTraversalTest.php` was updated
to assert the new counts.

## React portal

`frontend/src/portals/moderator/` holds a self-contained SPA that mounts
at `/moderator` (the top-level `App.tsx` now renders the moderator
portal as the default surface so the routing tree is visible). The
folder structure follows `docs/07` §29:

```
portals/moderator/
├── api/           # fetch client + typed API modules
├── components/    # EvidenceViewer, AiAnalysisPanel, AssignmentDialog, BulkActionsBar
├── design/        # Button, Card, Input, Select, Dialog, Badge, Spinner, Table, EmptyState
├── hooks/         # useKeyboardShortcuts
├── layout/        # ModeratorLayout (header + nav + Outlet)
├── pages/         # DashboardPage, ReviewQueuePage, ReportDetailPage, DuplicatesQueuePage, FraudQueuePage, AnalyticsPage, AiPerformancePage
└── types/         # domain types
```

State management: TanStack Query for server state (5 of the 5 pages
poll at 10–60 s intervals; the queue refreshes every 15 s by default).
No Redux, no Zustand — the portal is deliberately small.

Styling: Tailwind v4 only, no inline styles. Headless UI + React Router 7
are the only mandatory UI deps; ECharts is loaded only by the analytics
page (lazy chunked, ~166 kB gzipped).

## Keyboard shortcuts

The `useKeyboardShortcuts` hook skips events from `input` / `textarea` /
`select` / `contenteditable` so typing in forms is not intercepted. On
the report detail page:

| Key | Action |
| --- | ------ |
| `A` | Open the Approve dialog |
| `R` | Open the Reject dialog |
| `M` | Open the Merge dialog |
| `E` | Open the Escalate dialog |
| `N` | Jump to the next report in the queue |

These are surfaced as on-screen hints in the page header.

## Tests

| Layer | File | Tests | Status |
| ----- | ---- | ----- | ------ |
| Unit | `tests/Unit/Moderation/ReviewReportDtoTest.php` | 11 | green |
| Feature | `tests/Feature/Moderation/ModerationPolicyTest.php` | 10 | green |
| Feature | `tests/Feature/Moderation/ReviewServiceTest.php` | 6 | green |
| Feature | `tests/Feature/Moderation/MergeServiceTest.php` | 6 | green |
| Feature | `tests/Feature/Moderation/ModerationEndpointsTest.php` | 12 | green |
| Feature | `tests/Feature/Moderation/OpenApiModerationTest.php` | 8 | green |
| Frontend | `frontend/src/portals/moderator/design/cx.test.ts` | 4 | green |
| Frontend | `frontend/src/portals/moderator/design/Badge.test.tsx` | 2 | green |
| E2E | `frontend/e2e/a11y.spec.ts` | 1 | sandbox-blocked |
| E2E | `frontend/e2e/moderator-queue.spec.ts` | 3 | sandbox-blocked |

The Playwright E2E specs are blocked in this sandbox (no Chromium
binary; `npx playwright install` requires network); they will run on
the user's machine via `npm run e2e`.

## Definition of done

* [x] All 11 backend M10 tasks done (T-M10-001..T-M10-011).
* [x] All 7 frontend M10 pages render, lint clean, type-check clean,
      build green, Vitest green.
* [x] OpenAPI extension registered under the `Moderation` tag with all
      10 paths and 15 new schemas.
* [x] Audit log + workflow transition + event dispatch verified in the
      `ReviewServiceTest` / `MergeServiceTest` feature tests.
* [x] `docs/moderator.md` describes the queue, the four decisions, the
      audit trail, the AI overlay, the workflow additions, and the
      keyboard shortcuts.
* [x] `docs/05` §8 cross-referenced; the moderator REST surface is
      under the `Moderation` tag in `openapi.yaml`.
* [x] Playwright specs authored; the per-machine E2E run is the user's
      responsibility (sandbox cannot install Chromium).
