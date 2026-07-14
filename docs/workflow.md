# Workflow Engine (M6)

The workflow engine is the platform's state machine for civic report
lifecycle management. It is the single source of truth for the
**what state is this report in, what event fires next, and who is
allowed to fire it** questions.

It is defined end-to-end in `docs/02` §7, `docs/03` §9, `docs/04` §11,
`docs/05` §23, `docs/09` §11, and `docs/11` §9.

## Endpoints

| Method | Path                                       | Audience            | Notes                                     |
| ------ | ------------------------------------------ | ------------------- | ----------------------------------------- |
| GET    | `/api/v1/admin/workflows`                  | Super Admin         | Paginated list of workflow definitions    |
| POST   | `/api/v1/admin/workflows`                  | Super Admin         | Create a definition (with optional graph) |
| GET    | `/api/v1/admin/workflows/{workflow}`       | Super Admin         | Single definition with full graph         |
| PUT    | `/api/v1/admin/workflows/{workflow}`       | Super Admin         | Update / replace graph                    |
| DELETE | `/api/v1/admin/workflows/{workflow}`       | Super Admin         | Soft-delete (default civic def is locked) |

## Domain model

A workflow is a directed graph of **states** connected by **transitions**.

- `workflow_definitions` — the named container. Has a stable `code`
  (e.g. `civic_default`), a human `name`, an `active` flag, and
  soft-delete support.
- `workflow_states` — nodes. `(definition_id, code)` is unique.
  Carries `is_initial`, `is_terminal`, `sort_order`, `color`.
- `workflow_transitions` — edges. Indexed by
  `(from_state_id, event, priority)` for deterministic
  tie-breaking when multiple transitions share a (from, event)
  pair. Carries `required_role`, `required_permission`,
  `conditions` (JSON), `sla_minutes`, and `notify_before_minutes`.

## Default workflow: `civic_default`

Seeded by `DefaultWorkflowSeeder`. 11 states, 13 transitions.

### States

| Code                | Name             | Initial | Terminal |
| ------------------- | ---------------- | ------- | -------- |
| `draft`             | Draft            | yes     | no       |
| `submitted`         | Submitted        | no      | no       |
| `ai_processing`     | AI Processing    | no      | no       |
| `pending_moderator` | Pending Moderator| no      | no       |
| `assigned`          | Assigned         | no      | no       |
| `accepted`          | Accepted         | no      | no       |
| `in_progress`       | In Progress      | no      | no       |
| `resolved`          | Resolved         | no      | no       |
| `verified`          | Verified         | no      | yes      |
| `closed`            | Closed           | no      | yes      |
| `rejected`          | Rejected         | no      | yes      |

### Transitions

| From state         | Event              | To state           | Required role | SLA (min) |
| ------------------ | ------------------ | ------------------ | ------------- | --------- |
| `draft`            | `submit`           | `submitted`        | (any actor)   | -         |
| `submitted`        | `ai_complete`      | `ai_processing`    | `system`      | 30        |
| `ai_processing`    | `moderator_review` | `pending_moderator`| `system`      | 30        |
| `pending_moderator`| `assign`           | `assigned`         | `moderator`   | 120       |
| `assigned`         | `accept`           | `accepted`         | `department`  | 240       |
| `accepted`         | `start`            | `in_progress`      | `department`  | 1440      |
| `in_progress`      | `resolve`          | `resolved`         | `department`  | 4320      |
| `resolved`         | `close`            | `closed`           | `department`  | 4320      |
| `pending_moderator`| `reject`           | `rejected`         | `moderator`   | -         |
| `assigned`         | `reject`           | `rejected`         | `department`  | -         |
| `accepted`         | `reject`           | `rejected`         | `department`  | -         |
| `in_progress`      | `reject`           | `rejected`         | `department`  | -         |

## Engine contract

`WorkflowEngine::evaluate(Report $report, string $event, ?User $actor): WorkflowDecision`

The result is deterministic for a given
`(definition_id, from_state_code, event, actor)` tuple. The
highest-priority transition that passes the `TransitionGuard` wins.

`WorkflowEngine::apply(Report $report, WorkflowDecision $decision, ?User $actor): Report`

Applies a positive decision:
1. Updates `report.current_status_id` (bridge by `code` between
   `workflow_states.code` and `report_statuses.code`).
2. Dispatches `ReportStatusChanged` — the M4 `WriteStatusHistory`
   listener appends a `report_status_history` row (no double write).
3. Inserts an `audit_logs` row keyed on
   `(entity=reports, entity_id=report.id, action=workflow.transition)`.

All three steps run inside a single DB transaction.

## Role / permission enforcement

`TransitionGuard::ensure(WorkflowTransition $t, User $actor, Report $report)`

Three checks in order, first failure throws:

1. `required_role` (Spatie role name; null = any role accepted).
2. `required_permission` (Spatie permission; null = any).
3. `conditions` (JSON DSL evaluated against `report.*` and `actor.*`).

Failures:
- Role / permission failure -> `UnauthorizedTransitionException` (403).
- Condition failure -> `InvalidTransitionException` (422).

## Condition DSL

```json
{
  "report.priority_id": "emergency",
  "report.fraud_score":  { "lt": 0.3 },
  "actor.roles":         { "in": ["moderator", "super_admin"] },
  "report.is_anonymous": { "falsy": null }
}
```

Each top-level key is a dotted path into a frozen context
(`report.*` from the report model, `actor.*` from the authed user).
Each value is either a scalar (shorthand for `eq`) or a `{op: expected}`
map. Multiple ops on the same path are AND-joined.

Supported operators: `eq`, `ne`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`,
`between`, `truthy`, `falsy`.

## SLA timer

`CheckSlaBreaches` (queued job, scheduled every 5 minutes via
`routes/console.php`):

1. Stream all reports with a `workflow_id` + `current_status_id`.
2. For each, find the matching `workflow_state` and its outgoing
   transitions with a non-null `sla_minutes`.
3. Compute `elapsed_minutes = now - last_status_history.created_at`.
4. If `elapsed > sla_minutes` for any transition, dispatch
   `SlaBreached(reportId, currentStateCode, overdueTransitions[], elapsedMinutes)`.

Downstream listeners (M9 notifications) consume `SlaBreached` to
push alerts to the assigned role / department.

The job is **idempotent** and never mutates state.

## Cache invalidation

`WorkflowRepository` caches every `findActiveByCode` / `findById`
result for 1 hour. The cache key layout is:

- `workflow:def:code:<code>` -> the definition payload.
- `workflow:def:id:<id>` -> same payload, keyed by id.

Every `WorkflowAdminService::create()` / `update()` / `delete()`
calls `WorkflowRepository::invalidate($code)` (and, on a code
change, the new code too) so a Super Admin publish takes effect
on the next request without a deploy.

## Migration to a new workflow

The Super Admin can:

1. `POST /api/v1/admin/workflows` with the new `code`, `name`,
   and the full `states` + `transitions` payload.
2. Update the report->workflow default in a future M4 change
   (today every report is anchored to `civic_default` by
   `ReportService::submit()`).
3. Use `PUT /api/v1/admin/workflows/{id}` to fix a bug — the
   service does an in-place update of the `states` + `transitions`
   sets and invalidates the cache.

The default `civic_default` workflow is **protected** — it
cannot be deleted (it is referenced by every report), only
deactivated via `active: false`.
