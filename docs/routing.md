# Routing (M7)

Routing is the layer that decides **which department (and which officer)
a report lands with** after the AI vision engine has finished
classifying it. It is the bridge between the M6 workflow engine and
the M9 notifications + M10 portals.

It is defined end-to-end in `docs/02` §12, `docs/03` §16, `docs/04` §12,
`docs/05` §23, and `docs/09` §12.

## Endpoints

| Method | Path                                                | Audience                    | Notes                                          |
| ------ | --------------------------------------------------- | --------------------------- | ---------------------------------------------- |
| GET    | `/api/v1/admin/routing-rules`                       | Super Admin                 | Paginated list                                 |
| POST   | `/api/v1/admin/routing-rules`                       | Super Admin                 | Create a rule                                  |
| POST   | `/api/v1/admin/routing-rules/reorder`               | Super Admin                 | Reorder (10-step priority increments)          |
| GET    | `/api/v1/admin/routing-rules/{rule}`                | Super Admin                 | Single rule                                    |
| PUT    | `/api/v1/admin/routing-rules/{rule}`                | Super Admin                 | Partial update                                 |
| DELETE | `/api/v1/admin/routing-rules/{rule}`                | Super Admin                 | Soft-delete                                    |
| POST   | `/api/v1/admin/reports/{report}/reassign`           | Super Admin / Moderator     | Manual reassignment with audit                 |

## Domain model

A routing rule binds a JSON `conditions` payload to a destination
department (and optionally a default officer, priority, and SLA).

- `routing_rules`
  - `id` UUID primary key
  - `name` display label (unique per seeder)
  - `priority` int, lower = higher precedence (default 100)
  - `conditions` JSON DSL payload
  - `destination_department_id` UUID FK → `departments` (restrict)
  - `default_officer_id` UUID FK → `users` (nullable)
  - `default_priority_id` UUID FK → `report_priorities` (restrict)
  - `default_sla_minutes` int, 1..525600
  - `active` bool
  - `description`, `timestamps`, `softDeletes`

The `conditions` payload is the only field that the routing engine
itself interprets; every other field is opaque to the engine.

## Resolution algorithm

`RoutingEngine::resolve(Report)` is deterministic and side-effect free:

1. Load all `routing_rules` rows where `active = true` and
   `deleted_at IS NULL`, sorted by `(priority ASC, id ASC)`.
2. For each rule, evaluate the `conditions` DSL against the report.
3. Return the first match wrapped in a `RoutingDecision` value
   object (`matchedRule`, `destinationDepartment`, `defaultOfficer`,
   `defaultPriority`, `defaultSlaMinutes`).
4. If no rule matches, return `null`.

The caller (`AiCompletedListener`) is responsible for the fallback
when `null` is returned.

## RoutingCondition DSL

The DSL is a JSON object. Each top-level key is an **operator** and
its value is the operator's argument. An empty object `{}` matches
every report (catch-all).

### Operators

| Operator                | Argument                                          | Matches when…                                                                |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `category_in`           | `["code", ...]`                                   | the report's `reportType.code` is in the list                                |
| `ward_in`               | `["<ward_uuid>", ...]`                            | the report's `location.ward_id` is in the list                               |
| `district_in`           | `["<district_uuid>", ...]`                        | the report's `location.district_id` is in the list                           |
| `severity_in`           | `["code", ...]`                                   | the report's `priority.code` is in the list                                   |
| `keyword_match`         | `["word", ...]`                                   | any keyword is a case-insensitive substring of `title + description`         |
| `time_of_day_between`   | `["HH:MM", "HH:MM"]`                              | the report's `submitted_at` time is inside the window (wraps midnight)       |
| `ai_label_in`           | `["label", ...]`                                   | the report's `ai_label` column (set by M10 vision engine) is in the list     |

#### AND / OR semantics

Multiple top-level operators are **AND-joined**. A top-level `or` key
holds a list of sub-conditions; at least one OR sub-group must match
when the `or` key is present.

#### Examples

Catch-all (matches every report):

```json
{}
```

`category_in` only:

```json
{ "category_in": ["pothole", "road_damage"] }
```

`category_in` AND `severity_in`:

```json
{
  "category_in": ["garbage", "illegal_dumping"],
  "severity_in": ["high", "critical"]
}
```

`category_in` AND `(severity_in:high OR severity_in:critical OR ward_in:BBMP_W112)`:

```json
{
  "category_in": ["garbage"],
  "or": [
    { "severity_in": ["high"] },
    { "severity_in": ["critical"] },
    { "ward_in": ["<BBMP_W112_UUID>"] }
  ]
}
```

`keyword_match` (case-insensitive substring on title + description):

```json
{ "keyword_match": ["overflowing", "drainage", "sewage"] }
```

`time_of_day_between` (08:00–18:00):

```json
{ "time_of_day_between": ["08:00", "18:00"] }
```

`time_of_day_between` wrapping midnight (22:00–06:00):

```json
{ "time_of_day_between": ["22:00", "06:00"] }
```

`ai_label_in` (the M10 vision engine sets this):

```json
{ "ai_label_in": ["overflowing_garbage", "stagnant_water"] }
```

Combined (all 7 operators in one rule):

```json
{
  "category_in": ["garbage"],
  "ward_in": ["<BBMP_W112_UUID>"],
  "district_in": ["<BLR_URBAN_UUID>"],
  "severity_in": ["high"],
  "keyword_match": ["overflowing"],
  "time_of_day_between": ["00:00", "23:59"],
  "ai_label_in": ["overflowing_garbage"]
}
```

Nested `or` (OR-of-OR):

```json
{
  "category_in": ["garbage"],
  "or": [
    { "or": [ { "severity_in": ["low"] }, { "severity_in": ["high"] } ] }
  ]
}
```

## Rule ordering

`routing_rules.priority` is a positive int. Lower = higher precedence.
The tie-break on equal priority is the rule's UUID (lexicographic
ascending) so re-evaluation after a rule insert / update is stable.

The Super Admin Portal's reorder endpoint assigns priorities in
10-step increments starting at 10, so future inserts can be
slotted in between two existing rules.

## Fallback destination

When `RoutingEngine::resolve` returns `null`, the
`AiCompletedListener` consults the `RoutingFallbackService`. The
fallback destination is stored as an `app_configs` row:

```yaml
key:   "routing_default_department_id"
value: { "department_id": "<department_uuid>" }
enabled: true
```

When the AppConfig is absent, malformed, or references a missing
department, the listener throws `ROUTING_FALLBACK_MISSING` (HTTP
503). The platform refuses to silently drop a report.

The seeded Bangalore configuration points the fallback at
`BTP_TRAFFIC` (Bangalore Traffic Police) as a Super Admin
moderation queue.

## Assignment

Once a decision is produced (either by the engine or the fallback),
`AssignmentService::assign(Report, RoutingDecision, Actor, reason)`
performs the write:

1. Resolve the assigned officer — `decision.defaultOfficer` when
   present, otherwise round-robin across the destination
   department's staff list (cursor in the cache key
   `routing:rr:<department_id>`, 1-day TTL).
2. Insert a `report_assignments` row inside a DB transaction.
3. Mirror `department_id` and `priority_id` onto the
   `reports` row.
4. Dispatch the immutable `ReportAssigned` event so the M9
   notifications and downstream consumers fire.

The assignment is the only place the workflow engine's
`ai_auto_assign` event is fired. The transition moves the report
from `ai_processing` to `assigned` and is gated by the `system`
role (the platform's internal system user has both `system` and
`moderator` roles so the role check passes).

## Manual reassignment

`POST /api/v1/admin/reports/{report}/reassign` lets a Super Admin
or moderator override an automated assignment. The body is:

```json
{
  "department_id": "<uuid>",
  "officer_id":    "<uuid>?",
  "priority_id":   "<uuid>?",
  "reason":        "Wrong ward assigned by AI - manual override."
}
```

The endpoint:

1. Marks the active `report_assignments` row with a non-null
   `reassigned_at` (the previous row is preserved for audit).
2. Inserts a fresh `report_assignments` row.
3. Mirrors the new `department_id` and `priority_id` onto
   `reports`.
4. Writes an `audit_logs` row keyed on `(reports, {report_id},
   report.reassign)`.
5. Dispatches `ReportAssigned` for downstream consumers.

The reason is required and must be 3-500 characters.

## Cache strategy

`RoutingRepository::activeRules()` caches the active rule set
in the `routing` cache tag for 1 hour. CRUD writes (POST, PUT,
DELETE, reorder) call `Cache::tags('routing')->flush()` so the
next read picks up the new state. The 1-hour TTL is the safety
net for any cache miss.

## Audit + observability

Every CRUD on a routing rule writes an `audit_logs` row with:

- `entity = routing_rules`
- `entity_id = <rule_id>` (or `null` for reorder)
- `action = routing.create | routing.update | routing.delete | routing.reorder`
- `before` and `after` snapshots
- `user_id`, `ip`, `request_id`

Reassignments write an `audit_logs` row with
`action = report.reassign` and the same `before` / `after` shape.

## Bangalore sample rules

`RoutingRulesSeeder` upserts three rules:

| Name                              | Priority | Categories                                                | Destination            | SLA   |
| --------------------------------- | -------- | --------------------------------------------------------- | ---------------------- | ----- |
| `Garbage -> BBMP Ward 112`        | 10       | `garbage`, `illegal_dumping`, `dead_animal`, `open_drain` | BBMP_WARD_112          | 24h   |
| `Pothole -> BBMP Ward 112`        | 20       | `pothole`, `road_damage`                                  | BBMP_WARD_112          | 24h   |
| `Illegal Parking -> BTP`          | 30       | `illegal_parking`, `encroachment`                         | BTP_TRAFFIC            | 8h    |

The two destination departments (`BBMP_WARD_112`, `BTP_TRAFFIC`)
are upserted by `code` by the same seeder so the deployment does
not need a separate departments import.

## Test coverage

- `tests/Feature/Routing/RoutingRuleTest.php` — migration + model
- `tests/Feature/Routing/RoutingRulesMigrationTest.php` — column + index layout
- `tests/Feature/Routing/AssignmentServiceTest.php` — round-robin + write
- `tests/Feature/Routing/RoutingFlowTest.php` — end-to-end via `AiCompleted` event
- `tests/Feature/Routing/RoutingFallbackTest.php` — fallback config + 503
- `tests/Feature/Routing/RoutingCrudTest.php` — Super Admin CRUD + reorder
- `tests/Feature/Routing/ReassignTest.php` — manual reassignment + audit
- `tests/Feature/Routing/RoutingSeedTest.php` — Bangalore sample rules
- `tests/Feature/Routing/RoutingDeterminismTest.php` — 50-iteration determinism
- `tests/Feature/Routing/RoutingAuditTest.php` — CRUD writes audit rows
- `tests/Feature/Routing/RoutingRepositoryTest.php` — cache + invalidation
- `tests/Unit/Routing/RoutingConditionFullTest.php` — 31 DSL cases
- `tests/Feature/OpenApiRoutingTest.php` — OpenAPI surface smoke
