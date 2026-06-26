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
