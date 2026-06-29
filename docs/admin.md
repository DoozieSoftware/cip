# Super Admin Portal (M12)

The Super Admin Portal is the configuration plane of the Civic
Intelligence Platform. Per `docs/09` §2 it owns the data that
every other portal reads at runtime — report types, routing rules,
workflow definitions, AI provider credentials, integrations, storage,
notification channels, security policies, feature flags, organisations,
users, roles, and the platform health / scheduler dashboards.

This document describes the production wiring: the M12 REST surface,
the gating model, the audit trail, the OpenAPI contract, and the
React portal.

## Pipeline at a glance

```
   Operator (super_admin) signs in
        │
        ▼
   /admin                                          ← dashboard counts
        │
   /admin/users, /admin/roles, /admin/permissions
        │
   /admin/report-types                             ← category & schema config
        │
   /admin/integrations + /integrations/{id}/health
        │
   /admin/media-storage                            ← disk + retention
        │
   /admin/notification-configs                     ← channel credentials (masked)
        │
   /admin/security-policies                        ← password, OTP, rate limits
        │
   /admin/app-configs                              ← feature flags (incl. evaluate)
        │
   /admin/audit-logs                               ← read-only audit search
        │
   /admin/organizations                            ← multi-tenant config
        │
   /admin/scheduler/jobs                           ← list / pause / resume / run-now
        │
   /admin/platform-health                          ← DB, Redis, queue, AI, storage
```

## Roles

The portal is gated to the `super_admin` role; the `system` role
inherits the bypass for testability. Every other role — citizen,
moderator, department officer, auditor — is denied at the
Form-Request `authorize()` layer and at each controller's
`ensureAdmin(Request)` defensive check.

| Role | Read | Create | Update | Delete | Evaluate | Run-now |
| ---- | ---- | ------ | ------ | ------ | -------- | ------- |
| super_admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| system | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| auditor | partial (audit-logs only) | ✗ | ✗ | ✗ | ✗ | ✗ |
| moderator / department_officer / citizen | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

## REST surface (M12, all gated `auth:sanctum` + `throttle:admin`)

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET    | `/api/v1/admin/users` | paginated, filter `q`, `role`, `status` |
| POST   | `/api/v1/admin/users` | create (mobile unique) |
| GET    | `/api/v1/admin/users/{user}` | detail |
| PUT    | `/api/v1/admin/users/{user}` | update profile, role, status |
| DELETE | `/api/v1/admin/users/{user}` | soft delete |
| GET    | `/api/v1/admin/roles` | Spatie roles + permission pivot |
| POST   | `/api/v1/admin/roles` | create role |
| PUT    | `/api/v1/admin/roles/{role}` | update + sync permissions |
| DELETE | `/api/v1/admin/roles/{role}` | delete (protected roles guarded) |
| GET    | `/api/v1/admin/permissions` | full list |
| GET    | `/api/v1/admin/report-types` | paginated |
| POST   | `/api/v1/admin/report-types` | create |
| PUT    | `/api/v1/admin/report-types/{type}` | update |
| DELETE | `/api/v1/admin/report-types/{type}` | soft delete |
| GET    | `/api/v1/admin/workflows` | definitions + states + transitions |
| POST   | `/api/v1/admin/workflows` | create definition |
| PUT    | `/api/v1/admin/workflows/{wf}` | update + add/remove states/transitions |
| GET    | `/api/v1/admin/routing-rules` | paginated |
| POST   | `/api/v1/admin/routing-rules` | create (department + conditions) |
| PUT    | `/api/v1/admin/routing-rules/{rule}` | update (active toggle) |
| DELETE | `/api/v1/admin/routing-rules/{rule}` | soft delete |
| GET    | `/api/v1/admin/ai/providers` | list providers (key masked) |
| POST   | `/api/v1/admin/ai/providers` | create provider (key encrypted) |
| PUT    | `/api/v1/admin/ai/providers/{id}` | update |
| POST   | `/api/v1/admin/ai/providers/{id}/test` | live probe |
| POST   | `/api/v1/admin/ai/providers/{id}/activate` | flip active |
| GET    | `/api/v1/admin/ai/prompts` | list prompt versions |
| POST   | `/api/v1/admin/ai/prompts` | draft new version |
| POST   | `/api/v1/admin/ai/prompts/{id}/approve` | approve + publish |
| POST   | `/api/v1/admin/ai/prompts/{id}/rollback` | rollback to prior version |
| GET    | `/api/v1/admin/integrations` | paginated |
| POST   | `/api/v1/admin/integrations` | create (code unique) |
| PUT    | `/api/v1/admin/integrations/{id}` | update (credentials masked) |
| DELETE | `/api/v1/admin/integrations/{id}` | soft delete |
| POST   | `/api/v1/admin/integrations/{id}/health` | probe + flip status |
| GET    | `/api/v1/admin/media-storage` | current disk + retention |
| PUT    | `/api/v1/admin/media-storage` | flip disk + retention at runtime |
| POST   | `/api/v1/admin/media-storage/probe` | reachability test |
| GET    | `/api/v1/admin/notification-configs` | paginated, filter `channel`, `active` |
| POST   | `/api/v1/admin/notification-configs` | create (channel + code unique) |
| PUT    | `/api/v1/admin/notification-configs/{id}` | update (credentials masked) |
| DELETE | `/api/v1/admin/notification-configs/{id}` | soft delete |
| GET    | `/api/v1/admin/security-policies` | list |
| PUT    | `/api/v1/admin/security-policies` | upsert (key + JSON value) |
| GET    | `/api/v1/admin/app-configs` | list feature flags |
| POST   | `/api/v1/admin/app-configs` | create flag |
| PUT    | `/api/v1/admin/app-configs/{key}` | update flag |
| DELETE | `/api/v1/admin/app-configs/{key}` | soft delete |
| GET    | `/api/v1/admin/app-configs/{key}/evaluate` | deterministic evaluate (?user_id= / ?session_id=) |
| GET    | `/api/v1/admin/audit-logs` | paginated, filter `user_id`, `role`, `action`, `entity`, `entity_id`, `ip`, `date_from`, `date_to`, `q` |
| GET    | `/api/v1/admin/organizations` | paginated |
| POST   | `/api/v1/admin/organizations` | create |
| PUT    | `/api/v1/admin/organizations/{org}` | update (logo URL validated) |
| DELETE | `/api/v1/admin/organizations/{org}` | soft delete |
| GET    | `/api/v1/admin/scheduler/jobs` | registered jobs + status |
| POST   | `/api/v1/admin/scheduler/jobs/{id}/pause` | pause next run |
| POST   | `/api/v1/admin/scheduler/jobs/{id}/resume` | resume |
| POST   | `/api/v1/admin/scheduler/jobs/{id}/run-now` | synchronous safe-run |
| GET    | `/api/v1/admin/platform-health` | aggregate health (DB, Redis, queue, AI, storage, scheduler) |
| GET    | `/api/v1/admin/platform-health/components` | per-component status |

All endpoints are listed under the `Super Admin` (and per-area
sub-tags) in `backend/storage/api-docs/openapi.yaml`; the contract
is enforced by `tests/Feature/.../OpenApi*Test.php` suites.

## Service-layer rules

* Every admin controller extends `App\Modules\Shared\Http\Controllers\BaseController`
  and defines its own `private function ensureAdmin(Request $request): void`.
  The base class never owns this gate.
* `ApiException` is the single error envelope:
  `new ApiException(string $errorCode, string $message, int $httpStatus, array $details = [])`.
  The JSON response uses `code` (not `error_code`).
* `BaseService::transaction()` wraps every multi-write operation; never
  `withTransaction()`.
* `Resources` mask credentials: keys are kept, values are replaced with
  the literal string `'********'`. The plaintext is never echoed back.
* Form Request `authorize()` returns `$user->hasRole('super_admin')`.
  Controllers re-check via `ensureAdmin()` to be defensive.
* Migrations are append-only — never modify an existing migration, only add a new one.
  Filenames use `2026_06_29_xxxxxx_create_*.php`.

## Audit trail

Every write (POST/PUT/DELETE) goes through the M11 `AuditMiddleware`
which writes an `audit_logs` row with `user_id`, `role`, `action`,
`entity`, `entity_id`, `ip`, `device_fingerprint`, and the JSON diff.
The audit log is **immutable** — no admin endpoint exposes a write or
update on it. The read-only `/api/v1/admin/audit-logs` endpoint paginates
at max 500 per page, mirroring the M11 list convention.

## OpenAPI contract

`backend/storage/api-docs/openapi.yaml` is the single source of truth.
Every controller change is paired with a `paths:` entry (placed
immediately before `components:`) and a `schemas:` entry (placed before
the existing `PermissionStoreRequest:` schema). 13 contract-check tests
under `tests/Feature/.../OpenApi*Test.php` parse the YAML and assert
that every admin route is declared with the right tag, summary, request,
and response schemas. The OpenAPI spec is also served live at
`GET /api/v1/openapi.yaml`.

## React portal

The M12 portal is a React 19 + Vite SPA under
`frontend/src/portals/admin/`. The shell (`AdminApp.tsx` +
`layout/AdminLayout.tsx`) gives:

* a fuchsia-accented header with a role chip (`super_admin`),
* a horizontal tab bar covering Dashboard, Users, Roles & perms,
  Report types, Security, Feature flags, Audit log,
* TanStack Query data layer via `api/client.ts`,
* every page lazy-loaded with `React.lazy` and a `Spinner` fallback,
* auth guard via `ProtectedRoute allow={['super_admin','system']}`.

Pages implemented in this branch (T-M12-016..028):

* `AdminDashboard` — live counts from 5 list endpoints.
* `AdminUsers` — list, search, role / status editor (uses
  `apiRequest` + `useMutation` + query invalidation).
* `AdminRoles` — roles + permission checkboxes, protected-role lock.
* `AdminReportTypes` — full CRUD with `requires_photo`, `min_photos`,
  `max_photos`, `icon`, `color` editors.
* `AdminSecurityPolicies` — JSON value editor with type validation.
* `AdminFeatureFlags` — `enabled` switch, `rollout_percentage` slider,
  `cohort` JSON editor, and the **Evaluate** form (calls
  `GET /admin/app-configs/{key}/evaluate`).
* `AdminAuditLog` — filter chips (action, entity, user, date), paginated
  table, immutable-row lock.

## Tests

* 50 new M12 admin feature tests (T-M12-007..015 area) all pass.
* 13 OpenAPI contract tests pass.
* `AppConfigCrudTest` + `FeatureFlagEvaluationTest` exercise the
  flag CRUD + evaluate path.
* `Settings/FeatureFlagServiceTest` covers the deterministic
  bucket logic.

## See also

* `docs/09` — Super Admin portal specification.
* `docs/04` §18 — `app_configs` schema (feature flags).
* `docs/05` — REST API spec (admin endpoints).
* `docs/11` §40 — security policies.
* `docs/12` §34 — integrations.
* `docs/14` — DevOps (deploy, env, runbooks).
* `docs/15` §39 — release readiness checklist.
* `docs/M12_M13_HANDOVER.md` — closeout runbook.
