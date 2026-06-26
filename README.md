# Civic Intelligence Platform

A production-grade, AI-assisted civic issue reporting platform.

## Quickstart

```bash
# 1. Clone and enter
cd civic-platform

# 2. Bring up the full stack (MySQL, Redis, MinIO, Laravel, Nginx, queue, scheduler)
docker compose up -d

# 3. Run migrations + seeds
docker compose exec php php artisan migrate --seed

# 4. Open the API
curl http://localhost/api/v1/health

# 5. Open the API documentation
open http://localhost/api/documentation
```

## Architecture

- **Backend:** Laravel 12, PHP 8.4, MySQL 8.4 LTS, Redis, MinIO
- **Frontend:** React 19, TypeScript, Vite, Tailwind v4
- **AI:** Configurable provider abstraction; Qwen-VL default
- **Modules:** Each domain lives in `backend/app/Modules/<Name>/` with controllers, services, policies, events, jobs, requests, resources, tests.

See:
- [`docs/`](./docs) — full specification
- [`.codex/roadmap.md`](./.codex/roadmap.md) — implementation roadmap
- [`.codex/task_queue.md`](./.codex/task_queue.md) — atomic task queue
- [`.codex/current_milestone.md`](./.codex/current_milestone.md) — active milestone
- [`.codex/completed_tasks.md`](./.codex/completed_tasks.md) — implementation log

## Authentication

The M2 identity layer is in place. Citizens authenticate via OTP; staff authenticate via password (2FA-ready in M10+). Roles and permissions are powered by Spatie Permission. Every protected endpoint is rate-limited, audited, and emits a security event for the security team.

### Seeded roles

| Role | Purpose | Default abilities |
| --- | --- | --- |
| `citizen` | End user of the PWA | Submits reports, views own reports |
| `moderator` | Triage / close reports in the Moderator Portal (M10) | Moderates reports, can override AI |
| `department_officer` | Department staff (M11) | Operates on assigned reports |
| `department_admin` | Department lead (M11) | Manages the department's staff and SLAs |
| `super_admin` | Platform-wide full access (M12) | Every ability; protected role |
| `system` | Internal service account (jobs, AI worker) | Every ability; cannot log in via the web |
| `auditor` | Read-only across the platform | `*.view` permissions only |

Roles are seeded by `database/seeders/RolesAndPermissionsSeeder.php`; the seeder is idempotent and re-runnable.

### API surface

The Authentication namespace lives under `/api/v1/auth/*`:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/send-otp` | Request a 6-digit OTP (5/h per IP) |
| POST | `/api/v1/auth/verify-otp` | Verify the OTP, issue access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Rotate the refresh token (single-use) |
| POST | `/api/v1/auth/logout` | Revoke the current bearer and refresh tokens |
| GET | `/api/v1/auth/me` | Return the authenticated user (with roles + permissions) |

Full schemas and request/response examples are in the OpenAPI spec rendered at [`/api/documentation`](./backend/storage/api-docs/openapi.yaml) (the **Authentication** tag).

### Further reading

- [`docs/auth.md`](./docs/auth.md) — end-to-end explanation of the auth layer, error codes, and the audit / security-event pipeline
- `docs/05` §5 (Authentication APIs) and `docs/11` §6–10, §21, §28–29 (Security & Anti-Fraud) — authoritative spec
- `backend/app/Modules/Authentication/` — implementation


## M4 — Reports domain

The M4 Reports namespace is the citizen-facing write path and the
staff-facing read path for the `reports` table. It is fully
documented under the **Reports** tag in the OpenAPI spec
([`/api/documentation`](./backend/storage/api-docs/openapi.yaml)) and
in [`docs/reports.md`](./docs/reports.md).

| Method | Path                                       | Audience            | Notes                       |
| ------ | ------------------------------------------ | ------------------- | --------------------------- |
| POST   | `/api/v1/reports`                          | Citizen             | Create + submit in one step |
| POST   | `/api/v1/reports/{id}/submit`              | Citizen / Staff     | 2-step submit of a draft    |
| GET    | `/api/v1/reports`                          | Moderator / Staff   | Paginated staff search      |
| GET    | `/api/v1/reports/{id}`                     | Moderator / Staff   | Single report read          |
| GET    | `/api/v1/reports/{id}/timeline`            | Moderator / Staff   | Status transition history   |
| GET    | `/api/v1/citizen/dashboard`                | Citizen             | Aggregate counts            |
| GET    | `/api/v1/citizen/reports`                  | Citizen             | Own reports (paginated)     |
| GET    | `/api/v1/citizen/reports/{id}`             | Citizen / Staff     | Own report detail           |

The mutating endpoints honour the `Idempotency-Key` header. A replay
with the same `(key, user_id, request_hash)` returns the stored
response; a key reuse with a different payload returns 409
`IDEMPOTENCY_KEY_CONFLICT`. The tracking number scheme is
`CIV-YYYY-NNNNNN` and the in-app generator resets at year boundaries
(production deployment will swap in a distributed sequence).

Authorization is centralised in `ReportPolicy` and `LocationPolicy`
(extends `BasePolicy`). The standard error codes for the reports
module live in `App\Modules\Shared\Enums\ErrorCode`.

## M6 — Workflow engine

The M6 Workflow engine is the state machine that drives every
civic report through its 11-state lifecycle. It is fully
documented under the **Workflows** tag in the OpenAPI spec
([`/api/documentation`](./backend/storage/api-docs/openapi.yaml))
and in [`docs/workflow.md`](./docs/workflow.md).

### Default lifecycle

```
        draft
          |
          | submit (any actor)
          v
       submitted
          |
          | ai_complete (system, SLA 30m)
          v
    ai_processing
          |
          | moderator_review (system, SLA 30m)
          v
   pending_moderator -------+
          | assign (moderator, SLA 2h)      |
          | reject (moderator)               |
          v                                  v
      assigned                          rejected
          | accept (department, SLA 4h)
          | reject (department)
          v
      accepted
          | start (department, SLA 24h)
          | reject (department)
          v
    in_progress
          | resolve (department, SLA 72h)
          | reject (department)
          v
      resolved
          | verify (moderator, SLA 24h)
          v
      verified
          | close (moderator, SLA 72h)
          v
       closed
```

### Admin surface

| Method | Path                                | Notes                                |
| ------ | ----------------------------------- | ------------------------------------ |
| GET    | `/api/v1/admin/workflows`           | List definitions (paginated)         |
| POST   | `/api/v1/admin/workflows`           | Create a definition + optional graph |
| GET    | `/api/v1/admin/workflows/{workflow}`| Single definition with full graph    |
| PUT    | `/api/v1/admin/workflows/{workflow}`| Update; invalidates the read cache   |
| DELETE | `/api/v1/admin/workflows/{workflow}`| Soft-delete; `civic_default` is locked |

### Engine contract

`WorkflowEngine::evaluate(Report, event, actor): WorkflowDecision`
returns a positive or negative `WorkflowDecision` for the
highest-priority matching transition. The decision is
deterministic for a given
`(definition_id, from_state_code, event, actor)` tuple.

`WorkflowEngine::apply(Report, decision, actor): Report` runs
inside a single DB transaction: it updates `current_status_id`,
dispatches `ReportStatusChanged` (the M4 `WriteStatusHistory`
listener appends the `report_status_history` row — no double
write), and inserts an `audit_logs` row keyed on
`(entity=reports, action=workflow.transition)`.

### SLA timer

`CheckSlaBreaches` is a scheduled queued job (every 5 minutes,
wired in `routes/console.php`) that streams every report with
a workflow, computes `elapsed_minutes` against the outgoing
transitions' `sla_minutes`, and dispatches `SlaBreached` for
each overdue transition. Downstream M9 notifications consume
the event to push alerts to the assigned role / department.

### Cache invalidation

`WorkflowRepository` caches `findActiveByCode` / `findById` for
1 hour. Every `WorkflowAdminService` write calls
`WorkflowRepository::invalidate($code)` (and the new code on a
code change) so a Super Admin publish takes effect on the
next request without a deploy.

## M5 — Media & Evidence

The M5 Media namespace is the evidence layer for the platform:
citizens upload photos / videos / documents when they file a
report, those bytes are scanned, hashed, and persisted, and every
read/write is recorded in an append-only chain-of-custody log. The
full surface is documented under the **Media** tag in the OpenAPI
spec ([`/api/documentation`](./backend/storage/api-docs/openapi.yaml))
and in [`docs/media.md`](./docs/media.md).

| Method | Path                                          | Audience            | Notes                                    |
| ------ | --------------------------------------------- | ------------------- | ---------------------------------------- |
| POST   | `/api/v1/reports/{id}/photos`                 | Citizen (owner)     | 1-10 photos, jpeg/png, <= 16 MB each     |
| POST   | `/api/v1/reports/{id}/video`                  | Citizen (owner)     | 1 video, mp4/quicktime, <= 100 MB, 3-300 s |
| GET    | `/api/v1/reports/{id}/media`                  | Citizen / Staff     | Media list with 15-min signed URL        |
| GET    | `/api/v1/reports/{id}/media/{media}/audit`    | Staff               | Chain-of-custody log                     |
| GET    | `/api/v1/media/{media}/serve`                 | Public              | Signed-URL stream; signed URL is the auth |

Every upload passes three defence-in-depth gates (server-mime,
client-mime-agreement, magic-byte signature sniff), is scanned
(`LogScanner` in dev, `ClamAvScanner` in production via
`CIP_MEDIA_SCANNER=clamav`), and is hashed + thumbnailed
asynchronously on the `media` queue. All access is recorded in
`media_access_logs` (append-only, no `updated_at`).

### MinIO bucket

The `cip-media` bucket is created at first boot by
[`docker/minio/entrypoint.sh`](./docker/minio/entrypoint.sh). The
script uses `mc` (MinIO client) and idempotently creates the
bucket plus a 7-day lifecycle expiry on the `tmp/` prefix.

## Development


```bash
# Backend tests
cd backend && composer test

# Frontend tests
cd frontend && npm test

# Static analysis
cd backend && vendor/bin/phpstan analyse --level=max
cd frontend && npm run lint
```

## License

Proprietary. © Doozie Software Solutions.
