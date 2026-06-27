# Civic Intelligence Platform — Atomic Task Queue

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** Authoritative for AI-assisted implementation
**Source Documents:** `AGENTS.md`, `.codex/roadmap.md`, `docs/01`–`docs/16`

---

## How to Read This File

* Every entry is an **atomic implementation task** with a unique `T-<milestone>-<seq>` ID.
* Tasks are ordered so each one only depends on tasks earlier in the file.
* Every task targets **≤ 30 minutes** of focused implementation time. If a task feels larger, split it.
* Every task is **independently testable**: the `Required tests` field lists what must pass before the task can be marked Done.
* Every task is bounded to **one module** (or one tightly-scoped cross-cutting concern). Multi-module refactors are forbidden here.
* Status is always `Not Started` until the implementing agent marks it `In Progress` or `Done`.

### Field Schema

| Field | Meaning |
| --- | --- |
| Task ID | Stable identifier `T-M<n>-<seq>` |
| Milestone | `M1` … `M16` per `.codex/roadmap.md` |
| Title | Short imperative sentence |
| Description | What the agent must do, in 1–3 lines |
| Related specs | Doc IDs and section anchors that justify this task |
| Dependencies | Task IDs that must be Done first |
| Est. time | 5, 10, 15, 20, or 30 minutes |
| Files | File paths the agent is expected to create or modify |
| Acceptance criteria | Pass conditions, machine-checkable where possible |
| Required tests | Test files / cases that must pass |
| Status | `Not Started` (set by the agent during execution) |

### Module Boundaries

When the spec is ambiguous, the agent must stop and request clarification. The default module mapping used in this file is:

| Module | Path |
| --- | --- |
| Shared | `backend/app/Modules/Shared/`, `backend/app/Http/Middleware/`, `backend/app/Exceptions/` |
| Authentication | `backend/app/Modules/Authentication/` |
| Users | `backend/app/Modules/Users/` |
| Security | `backend/app/Modules/Security/` |
| Departments | `backend/app/Modules/Departments/` |
| Administration | `backend/app/Modules/Administration/` |
| Settings | `backend/app/Modules/Settings/` |
| Reports | `backend/app/Modules/Reports/` |
| Media | `backend/app/Modules/Media/` |
| Workflow | `backend/app/Modules/Workflow/` |
| Routing | `backend/app/Modules/Routing/` |
| AI | `backend/app/Modules/AI/` |
| Integrations | `backend/app/Modules/Integrations/` |
| Notifications | `backend/app/Modules/Notifications/` |
| Moderation | `backend/app/Modules/Moderation/` |
| Frontend shared | `frontend/packages/ui/`, `frontend/packages/api/`, `frontend/packages/config/` |
| Citizen PWA | `frontend/apps/citizen/` |
| Moderator Portal | `frontend/apps/moderator/` |
| Operations Portal | `frontend/apps/operations/` |
| Super Admin Portal | `frontend/apps/super-admin/` |
| Infrastructure | `docker/`, `.github/`, `docker-compose.yml` |

### Global Engineering Rules (apply to every task)

- PSR-12 backend, ESLint + Prettier frontend (`docs/14` §21).
- PHPStan max level on backend; strict TypeScript on frontend.
- No business logic in controllers / components / routes (`docs/03` §26, `docs/14` §39).
- No direct cross-module DB access; communicate via services or events (`docs/03` §6).
- UUID primary keys, InnoDB, utf8mb4, foreign keys enforced (`docs/04` §3, §16, `docs/16` §36).
- No hardcoded IDs, URLs, departments, categories (`docs/14` §39, `AGENTS.md`).
- Every mutating endpoint emits an audit row and an event (`docs/03` §19, `docs/11` §28).
- Every endpoint enforces AuthN + AuthZ + validation + rate limiting (`docs/11` §4).
- Prompts, AI models, departments, categories, workflows are DB-driven, never in source.
- Each task that creates a file must also create or update its README / OpenAPI where applicable.

---

## Task Count Summary

| Milestone | Task Count |
| --- | --- |
| M1 — Repository Bootstrap & Tooling | 22 |
| M2 — Identity, Auth & RBAC Core | 30 |
| M3 — Master Configuration & Geography | 24 |
| M4 — Reports Domain & Submission API | 32 |
| M5 — Media Pipeline & Evidence Integrity | 26 |
| M6 — Workflow Engine & State Machine | 22 |
| M7 — Routing Engine & Department Assignment | 18 |
| M8 — AI Vision Pipeline & Provider Abstraction | 30 |
| M9 — Notification & Eventing Platform | 20 |
| M10 — Moderator Portal | 28 |
| M11 — Operations Portal (Department) | 28 |
| M12 — Super Admin Portal & Platform Configuration | 34 |
| M13 — Citizen PWA | 30 |
| M14 — External Connector Framework | 24 |
| M15 — Security, Anti-Fraud & Compliance Hardening | 24 |
| M16 — Production Hardening, Observability & Release | 18 |
| **Total** | **410** |

---


## Milestone M1 — Repository Bootstrap & Tooling

**Source:** `.codex/roadmap.md` §M1. **Specs:** `AGENTS.md`, `docs/03`, `docs/04`, `docs/14`, `docs/15`, `docs/16`.

---

### T-M1-001 — Create root monorepo skeleton directories
- **Milestone:** M1
- **Title:** Create root monorepo skeleton directories
- **Description:** Create the top-level folders `backend/`, `frontend/`, `docker/`, `scripts/`, `.github/`, and add `.gitignore`, `.editorconfig`, `README.md` skeletons per `docs/14` §4 and `docs/16` §3.
- **Related specs:** `docs/14` §4; `docs/16` §3
- **Dependencies:** —
- **Est. time:** 10 minutes
- **Files:** `backend/`, `frontend/`, `docker/`, `scripts/`, `.github/`, `.gitignore`, `.editorconfig`, `README.md`
- **Acceptance criteria:** All folders exist; `.gitignore` excludes `vendor/`, `node_modules/`, `storage/logs/*`, `.env`, `dist/`; `README.md` has a "Quickstart" placeholder.
- **Required tests:** Manual: `ls -la` shows the new structure.
- **Status:** Done

### T-M1-002 — Initialize Laravel 12 backend
- **Milestone:** M1
- **Title:** Initialize Laravel 12 backend project
- **Description:** Run `composer create-project laravel/laravel backend "^12.0"`; confirm PHP 8.4; pin Laravel framework version.
- **Related specs:** `docs/14` §3, §14; `docs/16` §35
- **Dependencies:** T-M1-001
- **Est. time:** 15 minutes
- **Files:** `backend/composer.json`, `backend/artisan`, `backend/.env.example`
- **Acceptance criteria:** `php artisan --version` reports `Laravel Framework 12.x`; `composer.json` has `php: ^8.4`.
- **Required tests:** `php artisan --version`
- **Status:** Done

### T-M1-003 — Install Sanctum and configure API guard
- **Milestone:** M1
- **Title:** Install Laravel Sanctum and configure API guard
- **Description:** `composer require laravel/sanctum`; publish Sanctum config and migration; add `EnsureFrontendRequestsAreStateful` and the `api` guard wiring.
- **Related specs:** `docs/05` §2; `docs/16` §3
- **Dependencies:** T-M1-002
- **Est. time:** 10 minutes
- **Files:** `backend/config/sanctum.php`, `backend/config/auth.php`
- **Acceptance criteria:** `config/sanctum.php` exists; `auth.php` guards include `api` driver `sanctum`.
- **Required tests:** `php artisan vendor:publish --tag=sanctum-config` runs idempotently.
- **Status:** Done

### T-M1-004 — Install Spatie Permission
- **Milestone:** M1
- **Title:** Install Spatie Laravel Permission
- **Description:** `composer require spatie/laravel-permission`; publish config and migration; register the service provider if not auto-discovered.
- **Related specs:** `docs/03` §14; `docs/16` §3
- **Dependencies:** T-M1-002
- **Est. time:** 10 minutes
- **Files:** `backend/config/permission.php`, `backend/database/migrations/*_create_permission_tables.php`
- **Acceptance criteria:** Spatie migrations present; `HasRoles` trait usable on a model.
- **Required tests:** `php artisan migrate:status` lists the new Spatie migration.
- **Status:** Done

### T-M1-005 — Configure MySQL 8.4 LTS connection
- **Milestone:** M1
- **Title:** Configure MySQL 8.4 LTS connection
- **Description:** Update `backend/config/database.php` to set MySQL charset `utf8mb4`, collation `utf8mb4_unicode_ci`, engine `InnoDB`, strict mode; document `.env` DB_* keys.
- **Related specs:** `docs/04` §3; `docs/16` §36; `AGENTS.md` Coding Rules
- **Dependencies:** T-M1-002
- **Est. time:** 10 minutes
- **Files:** `backend/config/database.php`, `backend/.env.example`
- **Acceptance criteria:** `DB_CHARSET=utf8mb4`, `DB_COLLATION=utf8mb4_unicode_ci`, `DB_ENGINE=InnoDB`, `DB_STRICT=true`.
- **Required tests:** `php artisan tinker` → `DB::connection()->getPdo()->getAttribute(PDO::MYSQL_ATTR_INIT_COMMAND)` set.
- **Status:** Done

### T-M1-006 — Install PHPStan, Pint, and configure presets
- **Milestone:** M1
- **Title:** Install PHPStan and Pint
- **Description:** `composer require --dev phpstan/phpstan laravel/pint`; ship `phpstan.neon` at level `max` and `pint.json` with PSR-12 preset.
- **Related specs:** `docs/14` §21, §30; `AGENTS.md` Coding Rules
- **Dependencies:** T-M1-002
- **Est. time:** 10 minutes
- **Files:** `backend/phpstan.neon`, `backend/pint.json`
- **Acceptance criteria:** `vendor/bin/phpstan analyse --level=max` runs against `app/` without errors on a fresh install.
- **Required tests:** `composer test:phpstan` (script) exits 0.
- **Status:** Done

### T-M1-007 — Install and configure PestPHP
- **Milestone:** M1
- **Title:** Install and configure PestPHP
- **Description:** `composer require --dev pestphp/pest pestphp/pest-plugin-laravel`; replace the default PHPUnit test runner with Pest; add `tests/Pest.php` and `tests/TestCase.php`.
- **Related specs:** `docs/15` §6; `AGENTS.md` Testing
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/tests/Pest.php`, `backend/tests/TestCase.php`, `backend/phpunit.xml`
- **Acceptance criteria:** `vendor/bin/pest --version` runs; the default `ExampleTest.php` is rewritten as a Pest test and passes.
- **Required tests:** `vendor/bin/pest` exits 0 on default suite.
- **Status:** Done

### T-M1-008 — Initialize Vite + React 19 + TypeScript frontend
- **Milestone:** M1
- **Title:** Initialize Vite + React 19 + TypeScript frontend
- **Description:** `npm create vite@latest frontend -- --template react-ts`; pin React 19 in `package.json`; add Vite, Vitest, and `tsconfig.json` with `strict: true`.
- **Related specs:** `docs/14` §3; `docs/16` §3
- **Dependencies:** T-M1-001
- **Est. time:** 15 minutes
- **Files:** `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/src/`
- **Acceptance criteria:** `npm run build` succeeds; `npm run test` runs a trivial Vitest passing test.
- **Required tests:** `npm run test -- --run` exits 0.
- **Status:** Done

### T-M1-009 — Install frontend base libraries
- **Milestone:** M1
- **Title:** Install frontend base libraries
- **Description:** `npm i` TanStack Query, React Hook Form, Zod, React Router, Leaflet, ECharts, TailwindCSS v4, Headless UI.
- **Related specs:** `docs/06` §2; `docs/13`
- **Dependencies:** T-M1-008
- **Est. time:** 10 minutes
- **Files:** `frontend/package.json`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`
- **Acceptance criteria:** `npm run build` succeeds; `tailwind.config.js` content paths cover `src/**/*.{ts,tsx}`.
- **Required tests:** `npm run build` exits 0.
- **Status:** Done

### T-M1-010 — Configure ESLint and Prettier
- **Milestone:** M1
- **Title:** Configure ESLint and Prettier
- **Description:** Add `eslint.config.js` (flat config) with `@typescript-eslint`, `react`, `react-hooks`, `jsx-a11y`; add `prettier.config.js` and a `format` script.
- **Related specs:** `docs/14` §21
- **Dependencies:** T-M1-008
- **Est. time:** 10 minutes
- **Files:** `frontend/eslint.config.js`, `frontend/prettier.config.js`, `frontend/.prettierignore`
- **Acceptance criteria:** `npm run lint` exits 0; `npm run format` is idempotent.
- **Required tests:** `npm run lint` exits 0.
- **Status:** Done

### T-M1-011 — Author Docker Compose base services
- **Milestone:** M1
- **Title:** Author Docker Compose base services
- **Description:** Create `docker-compose.yml` with services `nginx`, `php` (Laravel app), `queue` (Horizon-ready), `scheduler`, `mysql` (8.4 LTS), `redis`, `minio`, plus a shared `docker/network.conf`.
- **Related specs:** `docs/14` §27, §28; `docs/16` §3
- **Dependencies:** T-M1-001
- **Est. time:** 20 minutes
- **Files:** `docker-compose.yml`, `docker/network.conf`
- **Acceptance criteria:** `docker compose config` validates; all services are declared with explicit image tags.
- **Required tests:** `docker compose config -q` exits 0.
- **Status:** Done

### T-M1-012 — Author PHP-FPM Dockerfile
- **Milestone:** M1
- **Title:** Author PHP-FPM Dockerfile
- **Description:** Write `docker/php/Dockerfile` based on `php:8.4-fpm`; install required extensions (`pdo_mysql`, `gd`, `intl`, `zip`, `bcmath`, `exif`); install Composer; non-root `app` user.
- **Related specs:** `docs/14` §3, §27
- **Dependencies:** T-M1-011
- **Est. time:** 15 minutes
- **Files:** `docker/php/Dockerfile`
- **Acceptance criteria:** `docker build docker/php` succeeds; `php -m` lists the required extensions.
- **Required tests:** Manual docker build.
- **Status:** Done

### T-M1-013 — Author Nginx site config
- **Milestone:** M1
- **Title:** Author Nginx site config
- **Description:** Write `docker/nginx/default.conf` with reverse-proxy rules to PHP-FPM, gzip, security headers (HSTS, X-Frame-Options, X-Content-Type-Options), and `client_max_body_size 100m` for media uploads.
- **Related specs:** `docs/11` §25; `docs/14` §27
- **Dependencies:** T-M1-011
- **Est. time:** 15 minutes
- **Files:** `docker/nginx/default.conf`
- **Acceptance criteria:** `nginx -t` would pass (assumes volume).
- **Required tests:** Static lint of the conf.
- **Status:** Done

### T-M1-014 — Author MinIO init script and bucket policy
- **Milestone:** M1
- **Title:** Author MinIO init script and bucket policy
- **Description:** Write `scripts/minio-init.sh` that creates the `cip-evidence` bucket with versioning + object-lock; document usage in README.
- **Related specs:** `docs/03` §12; `docs/05` §14
- **Dependencies:** T-M1-011
- **Est. time:** 10 minutes
- **Files:** `scripts/minio-init.sh`
- **Acceptance criteria:** Script is executable; bucket name and policy are documented inline.
- **Required tests:** `bash -n scripts/minio-init.sh` exits 0.
- **Status:** Done

### T-M1-015 — Wire Laravel storage to MinIO disk
- **Milestone:** M1
- **Title:** Wire Laravel storage to MinIO disk
- **Description:** Add `media_local` and `media_minio` disks in `backend/config/filesystems.php`; install `league/flysystem-aws-s3-v3`; use env-driven credentials.
- **Related specs:** `docs/03` §12; `docs/16` §3
- **Dependencies:** T-M1-005
- **Est. time:** 15 minutes
- **Files:** `backend/config/filesystems.php`
- **Acceptance criteria:** `Storage::disk('media_minio')->put('hello.txt', 'hi')` round-trips when env is set.
- **Required tests:** `php artisan tinker` integration probe.
- **Status:** Done

### T-M1-016 — Configure Laravel queue with Redis
- **Milestone:** M1
- **Title:** Configure Laravel queue with Redis
- **Description:** Set `QUEUE_CONNECTION=redis`; create the default connection; document Horizon readiness in `docs/14` §3.
- **Related specs:** `docs/03` §15; `docs/14` §3
- **Dependencies:** T-M1-005
- **Est. time:** 10 minutes
- **Files:** `backend/.env.example`, `backend/config/queue.php`
- **Acceptance criteria:** `php artisan queue:work --once` connects to Redis successfully.
- **Required tests:** `php artisan queue:work --once --tries=1` exits 0.
- **Status:** Done

### T-M1-017 — Add Shared module skeleton
- **Milestone:** M1
- **Title:** Add Shared module skeleton
- **Description:** Create `backend/app/Modules/Shared/` with `BaseController.php`, `BaseService.php`, `BasePolicy.php`, `ApiResponse.php` (trait), `ApiException.php`, `RequestId.php` (middleware).
- **Related specs:** `docs/03` §25; `docs/14` §8, §11
- **Dependencies:** T-M1-002
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Shared/BaseController.php`, `BaseService.php`, `BasePolicy.php`, `ApiResponse.php`, `ApiException.php`, `RequestId.php`
- **Acceptance criteria:** Each class file exists with the required method signature; `RequestId` is registered in `app/Http/Kernel.php`.
- **Required tests:** Pest test `tests/Unit/Shared/RequestIdTest.php` asserts a header is set.
- **Status:** Done

### T-M1-018 — Implement standard API response envelope
- **Milestone:** M1
- **Title:** Implement standard API response envelope
- **Description:** Implement `ApiResponse::success`, `ApiResponse::error`, `ApiResponse::paginated` per `docs/05` §3; apply in `BaseController::respond()`.
- **Related specs:** `docs/05` §3, §16
- **Dependencies:** T-M1-017
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Shared/ApiResponse.php`, `backend/app/Modules/Shared/BaseController.php`
- **Acceptance criteria:** JSON shape matches `{success, message, data, meta}` and `{success:false, message, errors, trace_id}`.
- **Required tests:** `tests/Unit/Shared/ApiResponseTest.php` covers both envelopes.
- **Status:** Done

### T-M1-019 — Implement domain ApiException and global handler
- **Milestone:** M1
- **Title:** Implement domain ApiException and global handler
- **Description:** Define `ApiException` with `code`, `message`, `httpStatus`, `details`; render in `bootstrap/app.php` to return the standard envelope with `trace_id`.
- **Related specs:** `docs/03` §20; `docs/14` §18
- **Dependencies:** T-M1-017
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Shared/ApiException.php`, `backend/bootstrap/app.php`
- **Acceptance criteria:** Throwing `ApiException::validation(...)` returns 422 + envelope; stack traces never appear in JSON.
- **Required tests:** Pest test in `tests/Feature/Shared/ExceptionRenderTest.php`.
- **Status:** Done

### T-M1-020 — Add /api/v1/health and /health/ready endpoints
- **Milestone:** M1
- **Title:** Add /api/v1/health and /health/ready endpoints
- **Description:** Implement `HealthController@live` (process), `HealthController@ready` (DB, Redis, MinIO, Queue); register routes; return JSON with per-component status.
- **Related specs:** `docs/03` §24; `docs/15` §27
- **Dependencies:** T-M1-017, T-M1-015, T-M1-016
- **Est. time:** 20 minutes
- **Files:** `backend/app/Http/Controllers/HealthController.php`, `backend/routes/api.php`
- **Acceptance criteria:** `GET /api/v1/health` returns 200 when all green; 503 when any component fails.
- **Required tests:** `tests/Feature/HealthCheckTest.php` covers both happy and degraded.
- **Status:** Done

### T-M1-021 — Author OpenAPI 3.1 scaffold
- **Milestone:** M1
- **Title:** Author OpenAPI 3.1 scaffold
- **Description:** Install `darkaonline/l5-swagger` or `swagger-php`; expose `/api/documentation`; ship an `openapi.yaml` that documents `/health`.
- **Related specs:** `docs/05` §23; `docs/16` §3
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/config/l5-swagger.php`, `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `GET /api/documentation` returns 200 with the Swagger UI; `openapi.yaml` validates.
- **Required tests:** `tests/Feature/OpenApiTest.php` asserts the JSON spec contains `/health`.
- **Status:** Done

### T-M1-022 — Author CI workflow (lint, analyse, test, build)
- **Milestone:** M1
- **Title:** Author CI workflow (lint, analyse, test, build)
- **Description:** Create `.github/workflows/ci.yml` with jobs: backend (pint, phpstan, pest), frontend (eslint, prettier, vitest, vite build), docker-build, dependency scan; required for `main` and PRs.
- **Related specs:** `docs/14` §29; `docs/15` §34
- **Dependencies:** T-M1-006, T-M1-007, T-M1-010
- **Est. time:** 20 minutes
- **Files:** `.github/workflows/ci.yml`
- **Acceptance criteria:** Workflow YAML is valid; required checks block merge via branch protection.
- **Required tests:** Actionlint or `yamllint`.
- **Status:** Done


---

## Milestone M2 — Identity, Auth & RBAC Core

**Source:** `.codex/roadmap.md` §M2. **Specs:** `docs/02` §4, §11, §17; `docs/03` §13–14, §19; `docs/05` §5; `docs/11` §6–9, §19, §21, §22; `docs/14` §19.

---

### T-M2-001 — Create users migration with UUID PK and soft deletes
- **Milestone:** M2
- **Title:** Create users migration with UUID PK and soft deletes
- **Description:** Migration `2026_*_create_users_table.php` with `id` UUID PK, `name`, `mobile` (unique), `email` (unique nullable), `password` (nullable for OTP-only), `otp_verified_at`, `anonymous_enabled`, `status`, `last_login_at`, `timestamps`, `deleted_at`.
- **Related specs:** `docs/04` §6; `docs/11` §6
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_users_table.php`
- **Acceptance criteria:** Table created with uuid PK, unique indexes on `mobile` and `email`, soft-delete column.
- **Required tests:** `php artisan migrate:fresh` succeeds; `tests/Feature/Auth/UsersTableTest.php` checks columns.
- **Status:** Done

### T-M2-002 — Create User Eloquent model with HasRoles
- **Milestone:** M2
- **Title:** Create User Eloquent model with HasRoles
- **Description:** `app/Modules/Users/Models/User.php` extending `Authenticatable`, using `HasApiTokens`, `HasRoles`, `SoftDeletes`, `HasUuids`; `casts` for `anonymous_enabled` and `otp_verified_at`.
- **Related specs:** `docs/03` §14; `docs/04` §6
- **Dependencies:** T-M2-001, T-M1-003, T-M1-004
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Users/Models/User.php`
- **Acceptance criteria:** Model boots; `$user->assignRole('citizen')` works.
- **Required tests:** `tests/Unit/Users/UserModelTest.php`.
- **Status:** Done

### T-M2-003 — Create UserFactory
- **Milestone:** M2
- **Title:** Create UserFactory
- **Description:** `database/factories/UserFactory.php` with states `citizen`, `moderator`, `departmentOfficer`, `superAdmin`.
- **Related specs:** `docs/04` §6; `docs/15` §6
- **Dependencies:** T-M2-002
- **Est. time:** 10 minutes
- **Files:** `backend/database/factories/Modules/Users/Models/UserFactory.php`
- **Acceptance criteria:** `User::factory()->citizen()->create()` returns a verified citizen.
- **Required tests:** `tests/Feature/Auth/UserFactoryTest.php`.
- **Status:** Done

### T-M2-004 — Create otps migration
- **Milestone:** M2
- **Title:** Create otps migration
- **Description:** Table `otps`: `id` UUID, `mobile`, `code_hash`, `expires_at`, `consumed_at`, `attempts`, `ip`, `user_agent`, `created_at`.
- **Related specs:** `docs/04` §6; `docs/11` §6
- **Dependencies:** T-M1-002
- **Est. time:** 10 minutes
- **Files:** `backend/database/migrations/*_create_otps_table.php`
- **Acceptance criteria:** Table created with index on `mobile`, `expires_at`.
- **Required tests:** Migration roundtrip test.
- **Status:** Done

### T-M2-005 — Create Otp Eloquent model
- **Milestone:** M2
- **Title:** Create Otp Eloquent model
- **Description:** `app/Modules/Authentication/Models/Otp.php` with `isExpired()`, `isConsumed()`, `incrementAttempts()`, scope for `latestFor(mobile)`.
- **Related specs:** `docs/04` §6
- **Dependencies:** T-M2-004
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Authentication/Models/Otp.php`
- **Acceptance criteria:** Model methods return correct booleans for seeded fixtures.
- **Required tests:** `tests/Unit/Authentication/OtpModelTest.php`.
- **Status:** Done

### T-M2-006 — Create refresh_tokens migration
- **Milestone:** M2
- **Title:** Create refresh_tokens migration
- **Description:** Table `refresh_tokens`: `id` UUID, `user_id` UUID FK, `token_hash`, `parent_id` UUID nullable, `expires_at`, `revoked_at`, `created_at`.
- **Related specs:** `docs/11` §7
- **Dependencies:** T-M2-001
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_refresh_tokens_table.php`
- **Acceptance criteria:** Migration roundtrips; FK enforced.
- **Required tests:** Migration + FK test.
- **Status:** Done

### T-M2-007 — Create RefreshToken model and rotation service
- **Milestone:** M2
- **Title:** Create RefreshToken model and rotation service
- **Description:** `app/Modules/Authentication/Models/RefreshToken.php`; `RefreshTokenService` with `issue(User)`, `rotate(RefreshToken)`, `revoke(RefreshToken)`; rotation invalidates parent.
- **Related specs:** `docs/11` §7
- **Dependencies:** T-M2-006
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Authentication/Models/RefreshToken.php`, `backend/app/Modules/Authentication/Services/RefreshTokenService.php`
- **Acceptance criteria:** Calling `rotate()` marks the parent revoked and returns a new token; old token cannot be used.
- **Required tests:** `tests/Feature/Authentication/RefreshTokenRotationTest.php`.
- **Status:** Done

### T-M2-008 — Create login_histories migration and model
- **Milestone:** M2
- **Title:** Create login_histories migration and model
- **Description:** Table `login_histories`: `id`, `user_id`, `ip`, `user_agent`, `device_fingerprint`, `success`, `failure_reason`, `created_at`.
- **Related specs:** `docs/11` §6, §28
- **Dependencies:** T-M2-001
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_login_histories_table.php`, `backend/app/Modules/Authentication/Models/LoginHistory.php`
- **Acceptance criteria:** Table created; model write/read works.
- **Required tests:** Migration + model test.
- **Status:** Done

### T-M2-009 — Create security_events migration and model
- **Milestone:** M2
- **Title:** Create security_events migration and model
- **Description:** Append-only table `security_events`: `id`, `user_id` nullable, `event`, `severity`, `metadata` JSON, `ip`, `user_agent`, `created_at`. No update/delete allowed in model.
- **Related specs:** `docs/11` §29
- **Dependencies:** T-M2-001
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_security_events_table.php`, `backend/app/Modules/Security/Models/SecurityEvent.php`
- **Acceptance criteria:** Insert works; `update` and `delete` raise `ModelImmutableException`.
- **Required tests:** `tests/Unit/Security/SecurityEventTest.php`.
- **Status:** Done

### T-M2-010 — Seed default roles and permissions
- **Milestone:** M2
- **Title:** Seed default roles and permissions
- **Description:** `database/seeders/RolesAndPermissionsSeeder.php` creating `citizen`, `moderator`, `department_officer`, `department_admin`, `super_admin`, `system`, `auditor` plus a baseline `reports.view`, `reports.create`, etc.
- **Related specs:** `docs/03` §14; `docs/09` §3
- **Dependencies:** T-M2-002, T-M1-004
- **Est. time:** 25 minutes
- **Files:** `backend/database/seeders/RolesAndPermissionsSeeder.php`, `backend/database/seeders/DatabaseSeeder.php`
- **Acceptance criteria:** `php artisan db:seed` is idempotent on second run; expected roles exist.
- **Required tests:** `tests/Feature/Auth/RoleSeedTest.php`.
- **Status:** Done

### T-M2-011 — Implement OtpService with rate limiting
- **Milestone:** M2
- **Title:** Implement OtpService with rate limiting
- **Description:** `OtpService::request(mobile, ip): array` enforcing 5 OTPs/hour per mobile and per IP; configurable expiry; stores only hash.
- **Related specs:** `docs/11` §6, §21
- **Dependencies:** T-M2-005, T-M2-008
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Authentication/Services/OtpService.php`
- **Acceptance criteria:** 6th request in an hour returns `RATE_LIMITED`; OTP stored as hash, not plaintext.
- **Required tests:** `tests/Feature/Authentication/OtpRateLimitTest.php`.
- **Status:** Done

### T-M2-012 — Implement SmsGateway interface and log driver
- **Milestone:** M2
- **Title:** Implement SmsGateway interface and log driver
- **Description:** Define `SmsGatewayInterface::send(mobile, message)`; ship `LogSmsGateway` writing to log channel; document provider selection via env.
- **Related specs:** `docs/11` §6; `docs/03` §17
- **Dependencies:** T-M2-011
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Notifications/Contracts/SmsGatewayInterface.php`, `backend/app/Modules/Notifications/Drivers/LogSmsGateway.php`
- **Acceptance criteria:** `LogSmsGateway` writes to `sms.log` channel; swappable via service container.
- **Required tests:** `tests/Unit/Notifications/LogSmsGatewayTest.php`.
- **Status:** Done

### T-M2-013 — POST /api/v1/auth/send-otp endpoint
- **Milestone:** M2
- **Title:** POST /api/v1/auth/send-otp endpoint
- **Description:** `AuthController@sendOtp` validates `mobile` (E.164-ish), calls `OtpService::request`, returns `{otp_sent:true}` (or `RATE_LIMITED`).
- **Related specs:** `docs/05` §5; `docs/11` §6
- **Dependencies:** T-M2-011, T-M1-018
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Authentication/Http/Controllers/AuthController.php`, `backend/app/Modules/Authentication/Http/Requests/SendOtpRequest.php`
- **Acceptance criteria:** 200 on success; 429 on rate limit; OTP never returned in response.
- **Required tests:** `tests/Feature/Authentication/SendOtpEndpointTest.php`.
- **Status:** Done

### T-M2-014 — POST /api/v1/auth/verify-otp endpoint
- **Milestone:** M2
- **Title:** POST /api/v1/auth/verify-otp endpoint
- **Description:** Validate code, find latest unconsumed OTP, mark consumed, upsert user, issue Sanctum token + refresh token, write login_history, emit `UserAuthenticated` event.
- **Related specs:** `docs/05` §5; `docs/11` §6
- **Dependencies:** T-M2-013, T-M2-007
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Authentication/Http/Controllers/AuthController.php`, `backend/app/Modules/Authentication/Http/Requests/VerifyOtpRequest.php`
- **Acceptance criteria:** Success returns `{token, refresh_token, user}`; failure returns 401 with typed error; login_history row written.
- **Required tests:** `tests/Feature/Authentication/VerifyOtpEndpointTest.php`.
- **Status:** Done

### T-M2-015 — POST /api/v1/auth/refresh endpoint
- **Milestone:** M2
- **Title:** POST /api/v1/auth/refresh endpoint
- **Description:** Accept refresh token, rotate via `RefreshTokenService::rotate`, return new access + refresh tokens.
- **Related specs:** `docs/05` §5; `docs/11` §7
- **Dependencies:** T-M2-007, T-M2-014
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Authentication/Http/Controllers/AuthController.php`
- **Acceptance criteria:** Old refresh token rejected on second use; new pair returned.
- **Required tests:** `tests/Feature/Authentication/RefreshEndpointTest.php`.
- **Status:** Done

### T-M2-016 — POST /api/v1/auth/logout endpoint
- **Milestone:** M2
- **Title:** POST /api/v1/auth/logout endpoint
- **Description:** Revoke the current access token, revoke the active refresh token, write security event `LOGOUT`.
- **Related specs:** `docs/05` §5; `docs/11` §6
- **Dependencies:** T-M2-014
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Authentication/Http/Controllers/AuthController.php`, `backend/bootstrap/app.php`, `backend/tests/Feature/Authentication/LogoutEndpointTest.php`
- **Acceptance criteria:** Subsequent calls with the same access token return 401; refresh token also rejected; unauthenticated calls return 401 with the standard error envelope.
- **Required tests:** `tests/Feature/Authentication/LogoutEndpointTest.php`.
- **Status:** Done

### T-M2-017 — GET /api/v1/auth/me endpoint
- **Milestone:** M2
- **Title:** GET /api/v1/auth/me endpoint
- **Description:** Return the authenticated user, roles, and permissions using a `UserResource`.
- **Related specs:** `docs/05` §5; `docs/11` §9
- **Dependencies:** T-M2-014
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Authentication/Http/Controllers/AuthController.php`, `backend/routes/api.php`, `backend/tests/Feature/Authentication/MeEndpointTest.php`
- **Acceptance criteria:** Response contains `id`, `mobile`, `roles`, `permissions`; password and 2FA fields are never exposed; unauthenticated and revoked-bearer requests return 401 with the standard envelope.
- **Required tests:** `tests/Feature/Authentication/MeEndpointTest.php`.
- **Status:** Done

### T-M2-018 — Implement device fingerprinting service
- **Milestone:** M2
- **Title:** Implement device fingerprinting service
- **Description:** `DeviceFingerprintService::fromRequest(Request): array` returns `{user_agent, screen, timezone, language, canvas, webgl, ip}`; tolerates missing fields.
- **Related specs:** `docs/11` §10
- **Dependencies:** T-M1-002
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Security/Services/DeviceFingerprintService.php`
- **Acceptance criteria:** Service returns a stable hash for the same input; missing fields do not throw.
- **Required tests:** `tests/Unit/Security/DeviceFingerprintServiceTest.php`.
- **Status:** Done

### T-M2-019 — Implement BasePolicy and RoleService
- **Milestone:** M2
- **Title:** Implement BasePolicy and RoleService
- **Description:** `app/Modules/Shared/BasePolicy.php` with `before()` checking role/permission; `RoleService::assign`, `revoke`, `hasPermission`; integrates with Spatie.
- **Related specs:** `docs/03` §14; `docs/11` §9
- **Dependencies:** T-M2-002
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Shared/Policies/BasePolicy.php`, `backend/app/Modules/Users/Services/RoleService.php`, `backend/app/Modules/Users/Events/UserRoleChanged.php`, `backend/app/Modules/Users/Events/UserPermissionChanged.php`
- **Acceptance criteria:** Policies block unauthorized access; `RoleService` is idempotent.
- **Required tests:** `tests/Feature/Users/RoleServiceTest.php`, `tests/Unit/Shared/BasePolicyTest.php`.
- **Status:** Done

### T-M2-020 — Implement audit middleware
- **Milestone:** M2
- **Title:** Implement audit middleware
- **Description:** `AuditMiddleware` captures entity, action, before/after, IP, device fingerprint, request id, user id; writes to `audit_logs`.
- **Related specs:** `docs/03` §19; `docs/11` §28
- **Dependencies:** T-M2-001, T-M2-018
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Security/Http/Middleware/AuditMiddleware.php`, `backend/app/Modules/Security/Models/AuditLog.php`, `backend/database/migrations/2026_06_26_190000_create_audit_logs_table.php`, `backend/bootstrap/app.php`, `backend/tests/Feature/Security/AuditMiddlewareTest.php`
- **Acceptance criteria:** A POST that mutates a record writes exactly one audit row.
- **Required tests:** `tests/Feature/Security/AuditMiddlewareTest.php`.
- **Status:** Done

### T-M2-021 — Implement security event capture
- **Milestone:** M2
- **Title:** Implement security event capture
- **Description:** `SecurityEventService::record(event, severity, metadata, user)`; called from auth endpoints, audit middleware, and future risk engine.
- **Related specs:** `docs/11` §29
- **Dependencies:** T-M2-009
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Security/Services/SecurityEventService.php`
- **Acceptance criteria:** `record` persists a row; model immutability test passes.
- **Required tests:** `tests/Feature/Security/SecurityEventServiceTest.php`.
- **Status:** Done

### T-M2-022 — Configure rate limiters per docs/11 §21 [DONE 2026-06-26 — commit bacdb1dc]
- **Milestone:** M2
- **Title:** Configure rate limiters per docs/11 §21
- **Description:** Register named limiters `otp`, `citizen`, `uploads`, `moderator`, `department`, `admin` in `App\Providers\RouteServiceProvider`.
- **Related specs:** `docs/11` §21
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/app/Providers/RouteServiceProvider.php`
- **Acceptance criteria:** `RateLimiter::for('otp')` returns `Limit::perHour(5)`; limiters are referenced in routes.
- **Required tests:** `tests/Feature/Security/RateLimiterTest.php`.
- **Status:** Done

### T-M2-023 — Apply rate limiters to auth routes [DONE 2026-06-26 — commit 5bfbd5d5]
- **Milestone:** M2
- **Title:** Apply rate limiters to auth routes
- **Description:** Wrap `/auth/send-otp` with `otp` limiter, `/auth/*` with `citizen` limiter; document per route.
- **Related specs:** `docs/11` §21
- **Dependencies:** T-M2-022, T-M2-013
- **Est. time:** 10 minutes
- **Files:** `backend/routes/api.php` (throttle middleware on /auth/send-otp, /auth/verify-otp, /auth/refresh, and the authenticated group)
- **Acceptance criteria:** 6th OTP request within an hour returns 429.
- **Required tests:** `tests/Feature/Authentication/OtpRateLimitRouteTest.php`.
- **Status:** Done

### T-M2-024 — Add UserResource with roles and permissions [DONE 2026-06-26 — commit e1c5c7da]
- **Milestone:** M2
- **Title:** Add UserResource with roles and permissions
- **Description:** `UserResource` exposes only safe fields; `roles` and `permissions` arrays are loaded lazily.
- **Related specs:** `docs/05` §3; `docs/11` §9
- **Dependencies:** T-M2-002
- **Est. time:** 10 minutes
- **Files:** `backend/app/Modules/Users/Http/Resources/UserResource.php`
- **Acceptance criteria:** Resource never leaks password hash or OTP.
- **Required tests:** `tests/Unit/Users/UserResourceTest.php`.
- **Status:** Done

### T-M2-025 — Document auth API in OpenAPI [DONE 2026-06-26 — commit 03757ab8]
- **Milestone:** M2
- **Title:** Document auth API in OpenAPI
- **Description:** Author/extend `storage/api-docs/openapi.yaml` paths for `auth/send-otp`, `auth/verify-otp`, `auth/refresh`, `auth/logout`, `auth/me`; add request/response schemas.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M2-017
- **Est. time:** 20 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `GET /api/documentation` renders new endpoints; `swagger-cli validate` passes.
- **Required tests:** `tests/Feature/OpenApiAuthTest.php`.
- **Status:** Done

### T-M2-026 — Add docs/auth.md [DONE 2026-06-26 — commit 4c2dd809]
- **Milestone:** M2
- **Title:** Add docs/auth.md
- **Description:** Author `docs/auth.md` covering OTP flow, JWT, refresh rotation, audit, rate limits, and security events; cross-link OpenAPI.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M2-025
- **Est. time:** 15 minutes
- **Files:** `docs/auth.md`
- **Acceptance criteria:** Document explains the happy path, error codes, and rotation.
- **Required tests:** Manual review checklist.
- **Status:** Done

### T-M2-027 — Add Pest feature suite for OTP throttle [DONE 2026-06-26 — commit 4074f0d5]
- **Milestone:** M2
- **Title:** Add Pest feature suite for OTP throttle
- **Description:** Cover: 5 successful requests, 6th returns 429, IP-based throttling, error code envelope.
- **Related specs:** `docs/15` §7
- **Dependencies:** T-M2-023
- **Est. time:** 20 minutes
- **Files:** `backend/tests/Feature/Authentication/OtpThrottleFeatureTest.php`
- **Acceptance criteria:** Suite passes; rate limits reset by `Cache::flush()` between tests.
- **Required tests:** `vendor/bin/pest tests/Feature/Authentication/OtpThrottleFeatureTest.php`.
- **Status:** Done

### T-M2-028 — Add Pest feature suite for refresh rotation [DONE 2026-06-26 — commit a906933b]
- **Milestone:** M2
- **Title:** Add Pest feature suite for refresh rotation
- **Description:** Cover: issue, rotate, old token rejected, second use of old token logs security event.
- **Related specs:** `docs/15` §7
- **Dependencies:** T-M2-015
- **Est. time:** 25 minutes
- **Files:** `backend/tests/Feature/Authentication/RefreshRotationFeatureTest.php`
- **Acceptance criteria:** All cases green; security event row present.
- **Required tests:** `vendor/bin/pest tests/Feature/Authentication/RefreshRotationFeatureTest.php`.
- **Status:** Done

### T-M2-029 — Add Pest feature suite for RBAC denials [DONE 2026-06-26 — commit 182527a8]
- **Milestone:** M2
- **Title:** Add Pest feature suite for RBAC denials
- **Description:** Cover: a `citizen` cannot hit moderator/admin routes; a `super_admin` can; an `auditor` is read-only.
- **Related specs:** `docs/11` §9
- **Dependencies:** T-M2-019, T-M2-010
- **Est. time:** 25 minutes
- **Files:** `backend/tests/Feature/Users/RbacDenialFeatureTest.php`
- **Acceptance criteria:** 403s returned with envelope; allowed roles return 200.
- **Required tests:** `vendor/bin/pest tests/Feature/Users/RbacDenialFeatureTest.php`.
- **Status:** Done

### T-M2-030 — Wire M2 documentation into README [DONE 2026-06-26 — commit b41379fa]
- **Milestone:** M2
- **Title:** Wire M2 documentation into README
- **Description:** Add an "Authentication" section to `README.md` that links to `docs/auth.md`, OpenAPI, and explains seeded roles.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M2-026
- **Est. time:** 10 minutes
- **Files:** `README.md`
- **Acceptance criteria:** README has a working anchor link to `docs/auth.md`.
- **Required tests:** Manual.
- **Status:** Done


---

## Milestone M3 — Master Configuration & Geography

**Source:** `.codex/roadmap.md` §M3. **Specs:** `docs/04` §5, §8, §17, §18; `docs/05` §10 (foundations); `docs/09` §7, §18; `docs/11` §40.

---

### T-M3-001 — Create countries migration and model [DONE 2026-06-26 — commit 200aa8]
- **Milestone:** M3
- **Title:** Create countries migration and model
- **Description:** Table `countries` with `id` UUID, `name`, `iso2` (unique), `iso3`, `phone_code`, `active`; model with fillable + casts.
- **Related specs:** `docs/04` §8
- **Dependencies:** T-M2-002
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_countries_table.php`, `backend/app/Modules/Departments/Models/Country.php`
- **Acceptance criteria:** `Country::create([...])` succeeds; seeder inserts "India" idempotently.
- **Required tests:** Migration + model test.
- **Status:** Done

### T-M3-002 — Create states migration and model [DONE 2026-06-26 — commit 503cb3]
- **Milestone:** M3
- **Title:** Create states migration and model
- **Description:** Table `states`: `id`, `country_id` FK, `name`, `code`, `active`; index on `(country_id, code)`.
- **Related specs:** `docs/04` §8
- **Dependencies:** T-M3-001
- **Est. time:** 10 minutes
- **Files:** `backend/database/migrations/*_create_states_table.php`, `backend/app/Modules/Departments/Models/State.php`
- **Acceptance criteria:** FK enforced; unique index on `(country_id, code)`.
- **Required tests:** Migration test.
- **Status:** Done

### T-M3-003 — Create districts migration and model [DONE 2026-06-26 — commit 47cf33]
- **Milestone:** M3
- **Title:** Create districts migration and model
- **Description:** Table `districts`: `id`, `state_id` FK, `name`, `code`, `active`.
- **Related specs:** `docs/04` §8
- **Dependencies:** T-M3-002
- **Est. time:** 10 minutes
- **Files:** `backend/database/migrations/*_create_districts_table.php`, `backend/app/Modules/Departments/Models/District.php`
- **Acceptance criteria:** FK enforced; `District::factory()->create()` works.
- **Required tests:** Migration + factory test.
- **Status:** Done

### T-M3-004 — Create cities migration and model [DONE 2026-06-27 — commit c6eba1]
- **Milestone:** M3
- **Title:** Create cities migration and model
- **Description:** Table `cities`: `id`, `district_id` FK, `name`, `code`, `active`.
- **Related specs:** `docs/04` §8
- **Dependencies:** T-M3-003
- **Est. time:** 10 minutes
- **Files:** `backend/database/migrations/*_create_cities_table.php`, `backend/app/Modules/Departments/Models/City.php`
- **Acceptance criteria:** FK enforced; `belongsTo District` works.
- **Required tests:** Migration + relationship test.
- **Status:** Done

### T-M3-005 — Create zones migration and model [DONE 2026-06-27 — commit dd2dd53]
- **Milestone:** M3
- **Title:** Create zones migration and model
- **Description:** Table `zones`: `id`, `city_id` FK, `name`, `code`, `active`.
- **Related specs:** `docs/04` §8
- **Dependencies:** T-M3-004
- **Est. time:** 10 minutes
- **Files:** `backend/database/migrations/*_create_zones_table.php`, `backend/app/Modules/Departments/Models/Zone.php`
- **Acceptance criteria:** FK enforced; soft delete disabled.
- **Required tests:** Migration + model test.
- **Status:** Done

### T-M3-006 — Create wards migration with spatial polygon [DONE 2026-06-27 — commit a8efb9e]
- **Milestone:** M3
- **Title:** Create wards migration with spatial polygon
- **Description:** Table `wards`: `id`, `city_id` FK, `zone_id` FK, `ward_number`, `name`, `municipality`, `boundary_polygon` (MySQL `POLYGON` with `NOT NULL` for seeded rows), spatial index on `boundary_polygon` via raw SQL.
- **Related specs:** `docs/04` §8, §24; `docs/16` §36
- **Dependencies:** T-M3-005
- **Est. time:** 25 minutes
- **Files:** `backend/database/migrations/*_create_wards_table.php`, `backend/app/Modules/Departments/Models/Ward.php`
- **Acceptance criteria:** Spatial index created; raw SQL guarded by `DB::statement`; insert roundtrips a polygon.
- **Required tests:** `tests/Feature/Geography/WardPolygonTest.php`.
- **Status:** Done

### T-M3-007 — Create departments migration [DONE 2026-06-27 — commit 61e3818]
- **Milestone:** M3
- **Title:** Create departments migration
- **Description:** Table `departments`: `id` UUID, `name`, `code` (unique), `parent_id` UUID nullable, `jurisdiction`, `address`, `email`, `phone`, `working_hours` JSON, `holiday_calendar` JSON, `default_workflow_id` UUID nullable, `default_sla_minutes`, `escalation_matrix` JSON, `active`, `timestamps`, `deleted_at`.
- **Related specs:** `docs/04` §5, §8; `docs/09` §7
- **Dependencies:** T-M1-002
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_departments_table.php`
- **Acceptance criteria:** Self-FK works; soft delete column present.
- **Required tests:** Migration test.
- **Status:** Done

### T-M3-008 — Create Department model with soft deletes [DONE 2026-06-27 — commit 31d77ee]
- **Milestone:** M3
- **Title:** Create Department model with soft deletes
- **Description:** `Department` model with `HasUuids`, `SoftDeletes`; relationships: `parent`, `children`, `users`.
- **Related specs:** `docs/04` §8, §21
- **Dependencies:** T-M3-007
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Departments/Models/Department.php`
- **Acceptance criteria:** `$dept->parent` and `$dept->children` return correct relations.
- **Required tests:** `tests/Unit/Departments/DepartmentModelTest.php`.
- **Status:** Done

### T-M3-009 — Create department_users pivot migration [DONE 2026-06-27 — commit 7f312bb]
- **Milestone:** M3
- **Title:** Create department_users pivot migration
- **Description:** Table `department_users`: `id`, `user_id` UUID FK, `department_id` UUID FK, `is_manager` bool, `assigned_at`, `timestamps`; unique `(user_id, department_id)`.
- **Related specs:** `docs/04` §5
- **Dependencies:** T-M3-007
- **Est. time:** 10 minutes
- **Files:** `backend/database/migrations/*_create_department_users_table.php`
- **Acceptance criteria:** Migration roundtrips; unique constraint enforced.
- **Required tests:** Migration test.
- **Status:** Done

### T-M3-010 — Create settings migration and model [DONE 2026-06-27 — commit 6a87d45]
- **Milestone:** M3
- **Title:** Create settings migration and model
- **Description:** Table `settings`: `id`, `key` (unique), `value` JSON, `type`, `description`, `is_public`, `timestamps`, `deleted_at`; model with casts.
- **Related specs:** `docs/04` §18
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_settings_table.php`, `backend/app/Modules/Settings/Models/Setting.php`
- **Acceptance criteria:** `Setting::set('foo', 'bar')` and `get('foo')` roundtrip.
- **Required tests:** `tests/Feature/Settings/SettingModelTest.php`.
- **Status:** Done

### T-M3-011 — Create app_configs migration and model (feature flags) [DONE 2026-06-27 — commit b8b460a]
- **Milestone:** M3
- **Title:** Create app_configs migration and model (feature flags)
- **Description:** Table `app_configs`: `id`, `key` (unique), `value` JSON, `enabled` bool, `rollout_percentage` (0-100), `cohort` JSON, `description`, `timestamps`.
- **Related specs:** `docs/04` §18; `docs/09` §18
- **Dependencies:** T-M3-010
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_app_configs_table.php`, `backend/app/Modules/Settings/Models/AppConfig.php`
- **Acceptance criteria:** Insert with rollout 0-100 works; cohort filter is JSON.
- **Required tests:** Model test.
- **Status:** Done

### T-M3-012 — Implement SettingsService with cache invalidation [DONE 2026-06-27 — commit c6edd1a]
- **Milestone:** M3
- **Title:** Implement SettingsService with cache invalidation
- **Description:** `SettingsService::get(key, default)`, `set(key, value, type)`, `forget(key)`; cache prefix `settings:` with TTL of 1h; `Cache::tags(['settings'])->flush()` on `set`/`forget`.
- **Related specs:** `docs/04` §18; `docs/09` §18
- **Dependencies:** T-M3-010
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Settings/Services/SettingsService.php`
- **Acceptance criteria:** Second `get` hits cache; `set` invalidates cache.
- **Required tests:** `tests/Feature/Settings/SettingsServiceTest.php`.
- **Status:** Done

### T-M3-013 — Implement FeatureFlagService [DONE 2026-06-27 — commit see git log]
- **Milestone:** M3
- **Title:** Implement FeatureFlagService
- **Description:** `FeatureFlagService::enabled(key, ?User $user = null): bool` evaluates boolean flag, rollout percentage via deterministic hash on `user_id`, and cohort match.
- **Related specs:** `docs/04` §18; `docs/09` §18
- **Dependencies:** T-M3-011
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Settings/Services/FeatureFlagService.php`
- **Acceptance criteria:** Same user always gets same answer; rollout 0 means never, 100 means always; cohort filter respected.
- **Required tests:** `tests/Feature/Settings/FeatureFlagServiceTest.php`.
- **Status:** Done

### T-M3-014 — DepartmentRepository and DepartmentService [DONE 2026-06-27 — commit 983a300]
- **Milestone:** M3
- **Title:** DepartmentRepository and DepartmentService
- **Description:** `DepartmentRepository` with search, paginate, and by-jurisdiction; `DepartmentService` for create/update/delete with audit emission.
- **Related specs:** `docs/14` §9
- **Dependencies:** T-M3-008
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Departments/Repositories/DepartmentRepository.php`, `backend/app/Modules/Departments/Services/DepartmentService.php`
- **Acceptance criteria:** Service emits `DepartmentCreated`, `DepartmentUpdated`, `DepartmentDeleted` events.
- **Required tests:** `tests/Feature/Departments/DepartmentServiceTest.php`.
- **Status:** Done

### T-M3-015 — GeographyRepository and GeographyService [DONE 2026-06-27 — commit 9869758]
- **Milestone:** M3
- **Title:** GeographyRepository and GeographyService
- **Description:** Repository with lookup helpers (`getStatesByCountry`, `getDistrictsByState`); Service enforces audit; uses `DTO`s for create/update.
- **Related specs:** `docs/14` §9, §10
- **Dependencies:** T-M3-006
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Departments/Repositories/GeographyRepository.php`, `backend/app/Modules/Departments/Services/GeographyService.php`
- **Acceptance criteria:** DTOs validated; helpers return paginated results.
- **Required tests:** `tests/Feature/Geography/GeographyServiceTest.php`.
- **Status:** Done

### T-M3-016 — Department CRUD endpoints [DONE 2026-06-27 — commit 95409e5]
- **Milestone:** M3
- **Title:** Department CRUD endpoints
- **Description:** `GET/POST/PUT/DELETE /api/v1/admin/departments`; uses Form Requests; `DepartmentResource`; gates via `super_admin` role.
- **Related specs:** `docs/05` §10; `docs/09` §7
- **Dependencies:** T-M3-014
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Departments/Http/Controllers/Admin/DepartmentController.php`, `backend/app/Modules/Departments/Http/Requests/StoreDepartmentRequest.php`, `backend/app/Modules/Departments/Http/Requests/UpdateDepartmentRequest.php`, `backend/app/Modules/Departments/Http/Resources/DepartmentResource.php`, `backend/routes/api.php`
- **Acceptance criteria:** All 5 endpoints respond; audit row per write; 403 for non-admin.
- **Required tests:** `tests/Feature/Departments/DepartmentCrudTest.php`.
- **Status:** Done

### T-M3-017 — Settings CRUD endpoints
- **Milestone:** M3
- **Title:** Settings CRUD endpoints
- **Description:** `GET/POST/PUT/DELETE /api/v1/admin/settings`; Form Requests validate type/value; uses `SettingsService`.
- **Related specs:** `docs/05` §10; `docs/09` §18
- **Dependencies:** T-M3-012
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Settings/Http/Controllers/Admin/SettingController.php`, `backend/app/Modules/Settings/Http/Requests/StoreSettingRequest.php`, `backend/app/Modules/Settings/Http/Resources/SettingResource.php`, `backend/routes/api.php`
- **Acceptance criteria:** Writes invalidate cache; reads return latest value.
- **Required tests:** `tests/Feature/Settings/SettingCrudTest.php`.
- **Status:** Done

### T-M3-018 — Feature flag CRUD endpoints
- **Milestone:** M3
- **Title:** Feature flag CRUD endpoints
- **Description:** `GET/POST/PUT/DELETE /api/v1/admin/app-configs`; reuse `FeatureFlagService` for evaluation; expose `/api/v1/admin/app-configs/{key}/evaluate?user_id=`.
- **Related specs:** `docs/05` §10
- **Dependencies:** T-M3-013
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Settings/Http/Controllers/Admin/AppConfigController.php`, `backend/app/Modules/Settings/Http/Requests/StoreAppConfigRequest.php`, `backend/app/Modules/Settings/Http/Resources/AppConfigResource.php`, `backend/routes/api.php`
- **Acceptance criteria:** Evaluate endpoint returns deterministic boolean.
- **Required tests:** `tests/Feature/Settings/AppConfigCrudTest.php`.
- **Status:** Done

### T-M3-019 — Seed India/Karnataka/Bangalore geography
- **Milestone:** M3
- **Title:** Seed India/Karnataka/Bangalore geography
- **Description:** `GeographySeeder` inserts India → Karnataka → Bangalore Urban/Rural districts → sample wards; idempotent via `updateOrCreate`.
- **Related specs:** `docs/04` §8
- **Dependencies:** T-M3-006
- **Est. time:** 25 minutes
- **Files:** `backend/database/seeders/GeographySeeder.php`
- **Acceptance criteria:** Second run does not duplicate rows; counts match expected.
- **Required tests:** `tests/Feature/Geography/GeographySeedTest.php`.
- **Status:** Done

### T-M3-020 — Seed default departments
- **Milestone:** M3
- **Title:** Seed default departments
- **Description:** `DepartmentsSeeder` inserts `BBMP`, `BTP`, `BWSSB`, `BESCOM` with default SLA and working hours.
- **Related specs:** `docs/04` §8
- **Dependencies:** T-M3-016
- **Est. time:** 15 minutes
- **Files:** `backend/database/seeders/DepartmentsSeeder.php`
- **Acceptance criteria:** `Department::where('code', 'BBMP')->exists()` is true.
- **Required tests:** `tests/Feature/Departments/DepartmentsSeedTest.php`.
- **Status:** Done

### T-M3-021 — Seed default feature flags
- **Milestone:** M3
- **Title:** Seed default feature flags
- **Description:** `AppConfigsSeeder` inserts the flags from `docs/09` §18 (`anonymous_reporting`, `ai_enabled`, `ocr_enabled`, `video_mandatory`, `moderator_required`, `public_dashboard`, `offline_mode`, `push_notifications`, `fraud_detection`, `duplicate_detection`).
- **Related specs:** `docs/09` §18
- **Dependencies:** T-M3-018
- **Est. time:** 20 minutes
- **Files:** `backend/database/seeders/AppConfigsSeeder.php`
- **Acceptance criteria:** All 10 flags exist; defaults match `docs/09`.
- **Required tests:** Seed test.
- **Status:** Done

### T-M3-022 — Document master-data strategy
- **Milestone:** M3
- **Title:** Document master-data strategy
- **Description:** Author `docs/master-data.md` explaining how to add a country/state/district/city/ward, add a department, add a feature flag.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M3-021
- **Est. time:** 15 minutes
- **Files:** `docs/master-data.md`
- **Acceptance criteria:** Each operation has a step-by-step example.
- **Required tests:** Manual review.
- **Status:** Done

### T-M3-023 — Update OpenAPI for admin geography/settings/flags
- **Milestone:** M3
- **Title:** Update OpenAPI for admin geography/settings/flags
- **Description:** Add admin endpoints, request/response schemas, and error codes to `openapi.yaml`.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M3-018
- **Est. time:** 20 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `swagger-cli validate` passes; new endpoints visible in Swagger UI.
- **Required tests:** `tests/Feature/OpenApiAdminTest.php`.
- **Status:** Done

### T-M3-024 — Add Pest feature suite for feature flag evaluation
- **Milestone:** M3
- **Title:** Add Pest feature suite for feature flag evaluation
- **Description:** Cover: boolean on/off, rollout 0/100, deterministic per-user, cohort match, missing flag default.
- **Related specs:** `docs/15` §7
- **Dependencies:** T-M3-021
- **Est. time:** 25 minutes
- **Files:** `backend/tests/Feature/Settings/FeatureFlagEvaluationTest.php`
- **Acceptance criteria:** All cases pass.
- **Required tests:** `vendor/bin/pest tests/Feature/Settings/FeatureFlagEvaluationTest.php`.
- **Status:** Done


---

## Milestone M4 — Reports Domain & Submission API

**Source:** `.codex/roadmap.md` §M4. **Specs:** `docs/02` §7, §8, §10, §11; `docs/04` §7, §12; `docs/05` §6, §7, §20, §24; `docs/11` §12, §13, §23.

---

### T-M4-001 — Create report_types migration
- **Milestone:** M4
- **Title:** Create report_types migration
- **Description:** Table `report_types`: `id` UUID, `name`, `code` (unique), `description`, `icon`, `color`, `department_default_id` UUID nullable, `requires_video` bool, `requires_photo` bool, `min_photos`, `max_photos`, `workflow_definition_id` UUID nullable, `validation_rules` JSON, `active`, `timestamps`, `deleted_at`.
- **Related specs:** `docs/04` §7
- **Dependencies:** T-M3-007
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_report_types_table.php`
- **Acceptance criteria:** Table created with all required fields and unique `code`.
- **Required tests:** Migration test.
- **Status:** Done

### T-M4-002 — Create ReportType model and factory
- **Milestone:** M4
- **Title:** Create ReportType model and factory
- **Description:** `ReportType` model with `HasUuids`, `SoftDeletes`, `casts` for booleans/ints/JSON; factory with default values.
- **Related specs:** `docs/04` §7
- **Dependencies:** T-M4-001
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Reports/Models/ReportType.php`, `backend/database/factories/ReportTypeFactory.php`
- **Acceptance criteria:** `ReportType::factory()->create()` succeeds.
- **Required tests:** `tests/Unit/Reports/ReportTypeModelTest.php`.
- **Status:** Done

### T-M4-003 — Create report_statuses migration and model
- **Milestone:** M4
- **Title:** Create report_statuses migration and model
- **Description:** Table `report_statuses`: `id`, `code` (unique), `name`, `description`, `color`, `is_terminal` bool, `sort_order` int, `active`.
- **Related specs:** `docs/04` §7
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_report_statuses_table.php`, `backend/app/Modules/Reports/Models/ReportStatus.php`
- **Acceptance criteria:** All 11 lifecycle codes can be inserted.
- **Required tests:** Migration + seed test.
- **Status:** Done

### T-M4-004 — Create report_priorities migration and model
- **Milestone:** M4
- **Title:** Create report_priorities migration and model
- **Description:** Table `report_priorities`: `id`, `code` (`low`, `medium`, `high`, `critical`, `emergency`), `name`, `sla_minutes`, `color`, `sort_order`, `active`.
- **Related specs:** `docs/04` §7
- **Dependencies:** T-M1-002
- **Est. time:** 10 minutes
- **Files:** `backend/database/migrations/*_create_report_priorities_table.php`, `backend/app/Modules/Reports/Models/ReportPriority.php`
- **Acceptance criteria:** Migration roundtrips.
- **Required tests:** Migration test.
- **Status:** Done

### T-M4-005 — Create locations migration with POINT geometry
- **Milestone:** M4
- **Title:** Create locations migration with POINT geometry
- **Description:** Table `locations`: `id` UUID, `latitude` decimal(10,7), `longitude` decimal(10,7), `altitude` decimal nullable, `accuracy` decimal nullable, `heading` decimal nullable, `speed` decimal nullable, `gps_provider`, `captured_at`, `geom` POINT (MySQL spatial via raw SQL), `address` string nullable, `ward_id` UUID nullable, `district_id` UUID nullable, `timestamps`.
- **Related specs:** `docs/04` §8, §24; `docs/16` §36
- **Dependencies:** T-M3-006
- **Est. time:** 25 minutes
- **Files:** `backend/database/migrations/*_create_locations_table.php`
- **Acceptance criteria:** Spatial index `idx_locations_geom` created via `DB::statement`.
- **Required tests:** Migration + spatial index probe.
- **Status:** Done

### T-M4-006 — Create Location model
- **Milestone:** M4
- **Title:** Create Location model
- **Description:** `Location` model with `HasUuids`; accessors for `latitude`/`longitude`; relationship to `Ward`.
- **Related specs:** `docs/04` §8
- **Dependencies:** T-M4-005
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Reports/Models/Location.php`
- **Acceptance criteria:** `$location->ward` returns the related model.
- **Required tests:** Model test.
- **Status:** Done

### T-M4-007 — Create reports migration
- **Milestone:** M4
- **Title:** Create reports migration
- **Description:** Table `reports`: `id` UUID, `tracking_number` (unique), `citizen_id` UUID FK, `report_type_id` UUID FK, `department_id` UUID nullable, `current_status_id` UUID FK, `priority_id` UUID FK, `workflow_id` UUID nullable, `location_id` UUID FK, `assigned_to` UUID nullable, `title`, `description`, `ai_confidence` decimal nullable, `fraud_score` decimal nullable, `duplicate_score` decimal nullable, `is_anonymous` bool, `is_verified` bool, `submitted_at` nullable, `closed_at` nullable, `timestamps`; indexes on tracking_number, status, department, workflow, citizen, submitted_at.
- **Related specs:** `docs/04` §7, §24
- **Dependencies:** T-M4-005
- **Est. time:** 25 minutes
- **Files:** `backend/database/migrations/*_create_reports_table.php`
- **Acceptance criteria:** All FKs and indexes created.
- **Required tests:** Migration + index probe.
- **Status:** Done

### T-M4-008 — Create Report model and factory
- **Milestone:** M4
- **Title:** Create Report model and factory
- **Description:** `Report` model with `HasUuids`, casts, factories, `boot()` generates `tracking_number` (`CIV-YYYY-NNNNNN`).
- **Related specs:** `docs/04` §7
- **Dependencies:** T-M4-007
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Reports/Models/Report.php`, `backend/database/factories/ReportFactory.php`
- **Acceptance criteria:** `Report::factory()->create()` produces a unique tracking number.
- **Required tests:** `tests/Unit/Reports/ReportModelTest.php`.
- **Status:** Done

### T-M4-009 — Create report_status_history migration
- **Milestone:** M4
- **Title:** Create report_status_history migration
- **Description:** Table `report_status_history`: `id`, `report_id` UUID FK, `from_status_id` UUID nullable, `to_status_id` UUID FK, `actor_id` UUID nullable, `reason`, `metadata` JSON, `created_at`.
- **Related specs:** `docs/04` §7
- **Dependencies:** T-M4-007
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_report_status_history_table.php`
- **Acceptance criteria:** Migration roundtrips.
- **Required tests:** Migration test.
- **Status:** Done

### T-M4-010 — Create report_assignments migration
- **Milestone:** M4
- **Title:** Create report_assignments migration
- **Description:** Table `report_assignments`: `id`, `report_id` UUID FK, `department_id` UUID FK, `officer_id` UUID nullable, `assigned_by` UUID nullable, `assigned_at`, `accepted_at` nullable, `completed_at` nullable, `reassignment_reason` nullable, `timestamps`.
- **Related specs:** `docs/04` §7, §12
- **Dependencies:** T-M4-007
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_report_assignments_table.php`
- **Acceptance criteria:** FKs enforced; supports reassignment via new row.
- **Required tests:** Migration test.
- **Status:** Done

### T-M4-011 — Create idempotency_keys migration
- **Milestone:** M4
- **Title:** Create idempotency_keys migration
- **Description:** Table `idempotency_keys`: `id`, `key` (unique), `user_id` UUID nullable, `route`, `request_hash`, `response_status`, `response_body` JSON, `created_at`.
- **Related specs:** `docs/05` §20
- **Dependencies:** T-M2-001
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_idempotency_keys_table.php`
- **Acceptance criteria:** Unique key constraint enforced.
- **Required tests:** Migration test.
- **Status:** Done

### T-M4-012 — Seed report_statuses and priorities
- **Milestone:** M4
- **Title:** Seed report_statuses and priorities
- **Description:** `ReportStatusesSeeder` inserts the 11 lifecycle states; `ReportPrioritiesSeeder` inserts 5 priority levels with default SLAs.
- **Related specs:** `docs/02` §7; `docs/04` §7
- **Dependencies:** T-M4-003, T-M4-004
- **Est. time:** 20 minutes
- **Files:** `backend/database/seeders/ReportStatusesSeeder.php`, `backend/database/seeders/ReportPrioritiesSeeder.php`
- **Acceptance criteria:** Seeders are idempotent; counts match.
- **Required tests:** Seed test.
- **Status:** Done

### T-M4-013 — Seed default report types
- **Milestone:** M4
- **Title:** Seed default report types
- **Description:** `ReportTypesSeeder` inserts `Illegal Parking`, `Garbage`, `Pothole`, `Streetlight`, `Water Leakage`, `Road Damage`, `Illegal Dumping`, `Encroachment`, `Dead Animal`, `Open Drain` with `requires_video=true` and `requires_photo=true`.
- **Related specs:** `docs/04` §7
- **Dependencies:** T-M4-002
- **Est. time:** 20 minutes
- **Files:** `backend/database/seeders/ReportTypesSeeder.php`
- **Acceptance criteria:** 10 report types present.
- **Required tests:** Seed test.
- **Status:** Done

### T-M4-014 — Implement DTOs for report create/submit
- **Milestone:** M4
- **Title:** Implement DTOs for report create/submit
- **Description:** `CreateReportDto` and `SubmitReportDto` are readonly POPOs with fromArray/fromRequest factories; no HTTP types.
- **Related specs:** `docs/14` §10
- **Dependencies:** T-M1-002
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Reports/DTO/CreateReportDto.php`, `backend/app/Modules/Reports/DTO/SubmitReportDto.php`
- **Acceptance criteria:** DTOs are immutable; `fromArray` validates required keys.
- **Required tests:** `tests/Unit/Reports/DtoTest.php`.
- **Status:** Done

### T-M4-015 — Implement ReportRepository
- **Milestone:** M4
- **Title:** Implement ReportRepository
- **Description:** `ReportRepository` with `create`, `update`, `findByTrackingNumber`, paginated `searchByRole`, `searchForCitizen`, `paginateTimeline`.
- **Related specs:** `docs/14` §9; `docs/05` §15
- **Dependencies:** T-M4-008
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Reports/Repositories/ReportRepository.php`
- **Acceptance criteria:** All search methods support filter, sort, page, per_page.
- **Required tests:** `tests/Feature/Reports/ReportRepositoryTest.php`.
- **Status:** Done

### T-M4-016 — Implement LocationService with reverse-geocoding stub
- **Milestone:** M4
- **Title:** Implement LocationService with reverse-geocoding stub
- **Description:** `LocationService::createFromSubmission(DTO): Location` validates lat/lng range, accuracy threshold, speed sanity; reverse-geocoding stub returns address from env.
- **Related specs:** `docs/11` §12
- **Dependencies:** T-M4-006
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Reports/Services/LocationService.php`
- **Acceptance criteria:** Invalid coordinates return `INVALID_GPS`; speed > 200 m/s flagged.
- **Required tests:** `tests/Feature/Reports/LocationServiceTest.php`.
- **Status:** Done

### T-M4-017 — Implement ReportService
- **Milestone:** M4
- **Title:** Implement ReportService
- **Description:** `ReportService::createDraft`, `updateDraft`, `submit`, `transitionTo`; uses DTOs; emits events `ReportDrafted`, `ReportSubmitted`; status history listener writes rows.
- **Related specs:** `docs/14` §8
- **Dependencies:** T-M4-015, T-M4-016, T-M4-014
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Reports/Services/ReportService.php`
- **Acceptance criteria:** Calling `submit` writes one row to `reports` and one to `report_status_history`.
- **Required tests:** `tests/Feature/Reports/ReportServiceTest.php`.
- **Status:** Done

### T-M4-018 — Implement ReportStatusChanged event and listener
- **Milestone:** M4
- **Title:** Implement ReportStatusChanged event and listener
- **Description:** `ReportStatusChanged` immutable event; `WriteStatusHistory` listener persists to `report_status_history`; both wired in `EventServiceProvider`.
- **Related specs:** `docs/03` §16; `docs/14` §17
- **Dependencies:** T-M4-017
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Reports/Events/ReportStatusChanged.php`, `backend/app/Modules/Reports/Listeners/WriteStatusHistory.php`
- **Acceptance criteria:** Every transition appends one history row.
- **Required tests:** `tests/Feature/Reports/StatusHistoryListenerTest.php`.
- **Status:** Done

### T-M4-019 — Implement ReportPolicy and LocationPolicy
- **Milestone:** M4
- **Title:** Implement ReportPolicy and LocationPolicy
- **Description:** `ReportPolicy::view` requires ownership or staff role; `LocationPolicy` mirrors rules; both extend `BasePolicy`.
- **Related specs:** `docs/11` §9, §27
- **Dependencies:** T-M4-008, T-M2-019
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Reports/Policies/ReportPolicy.php`, `backend/app/Modules/Reports/Policies/LocationPolicy.php`
- **Acceptance criteria:** Citizen A cannot read citizen B's report; moderator can.
- **Required tests:** `tests/Feature/Reports/PolicyTest.php`.
- **Status:** Done

### T-M4-020 — Implement IdempotencyKey middleware
- **Milestone:** M4
- **Title:** Implement IdempotencyKey middleware
- **Description:** `IdempotencyKey` middleware checks `Idempotency-Key` header; on replay, returns stored response; otherwise runs handler and stores result.
- **Related specs:** `docs/05` §20; `docs/11` §23
- **Dependencies:** T-M4-011
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Shared/Http/Middleware/IdempotencyKey.php`
- **Acceptance criteria:** Replay within window returns identical body and status.
- **Required tests:** `tests/Feature/Shared/IdempotencyKeyMiddlewareTest.php`.
- **Status:** Done

### T-M4-021 — Implement SubmitReportRequest
- **Milestone:** M4
- **Title:** Implement SubmitReportRequest
- **Description:** `SubmitReportRequest` validates `report_type_id`, `latitude`, `longitude`, `accuracy`, `title`, `description`, `is_anonymous`; uses custom rule `LocationAccuracy`.
- **Related specs:** `docs/14` §11
- **Dependencies:** T-M4-014
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Reports/Http/Requests/SubmitReportRequest.php`, `backend/app/Modules/Reports/Rules/LocationAccuracy.php`
- **Acceptance criteria:** 422 with field-level errors on bad input; cross-field rule rejects missing GPS.
- **Required tests:** `tests/Feature/Reports/SubmitReportRequestTest.php`.
- **Status:** Done

### T-M4-022 — POST /api/v1/reports endpoint
- **Milestone:** M4
- **Title:** POST /api/v1/reports endpoint
- **Description:** `ReportsController@store` validates, applies `IdempotencyKey` + `ReportPolicy`, calls `ReportService::createDraft`, returns `ReportResource` with `tracking_number`.
- **Related specs:** `docs/05` §6, §20
- **Dependencies:** T-M4-020, T-M4-021, T-M4-019, T-M4-017
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php`, `backend/app/Modules/Reports/Http/Resources/ReportResource.php`
- **Acceptance criteria:** 201 on success; 422 on validation; 409 on duplicate idempotency-key mismatch.
- **Required tests:** `tests/Feature/Reports/CreateReportEndpointTest.php`.
- **Status:** Done

### T-M4-023 — POST /api/v1/reports/{id}/submit endpoint
- **Milestone:** M4
- **Title:** POST /api/v1/reports/{id}/submit endpoint
- **Description:** `ReportsController@submit` calls `ReportService::submit`, emits `ReportSubmitted` event, returns updated `ReportResource`.
- **Related specs:** `docs/05` §6
- **Dependencies:** T-M4-022
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php`
- **Acceptance criteria:** Status moves `Draft → Submitted`; idempotent; 403 if not owner.
- **Required tests:** `tests/Feature/Reports/SubmitReportEndpointTest.php`.
- **Status:** Done

### T-M4-024 — GET /api/v1/reports/{id} endpoint
- **Milestone:** M4
- **Title:** GET /api/v1/reports/{id} endpoint
- **Description:** `ReportsController@show` returns full report with `location`, `reportType`, `status`, `priority`; gates via `ReportPolicy`.
- **Related specs:** `docs/05` §7
- **Dependencies:** T-M4-022
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php`
- **Acceptance criteria:** 200 for owner/staff; 403 for other citizens; 404 if missing.
- **Required tests:** `tests/Feature/Reports/ShowReportEndpointTest.php`.
- **Status:** Done

### T-M4-025 — GET /api/v1/reports search endpoint
- **Milestone:** M4
- **Title:** GET /api/v1/reports search endpoint
- **Description:** `ReportsController@index` paginates with filters `status`, `department`, `ward`, `priority`, `date_from`, `date_to`, `search`; staff only.
- **Related specs:** `docs/05` §7, §15–16
- **Dependencies:** T-M4-015
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php`
- **Acceptance criteria:** Filters compose; pagination meta correct.
- **Required tests:** `tests/Feature/Reports/SearchReportsEndpointTest.php`.
- **Status:** Done

### T-M4-026 — GET /api/v1/reports/{id}/timeline endpoint
- **Milestone:** M4
- **Title:** GET /api/v1/reports/{id}/timeline endpoint
- **Description:** `ReportsController@timeline` returns `report_status_history` ordered by `created_at`; uses `TimelineEntryResource`.
- **Related specs:** `docs/05` §7
- **Dependencies:** T-M4-024
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Reports/Http/Controllers/Api/ReportsController.php`, `backend/app/Modules/Reports/Http/Resources/TimelineEntryResource.php`
- **Acceptance criteria:** Returns status changes with actor, from, to, reason, timestamp.
- **Required tests:** `tests/Feature/Reports/TimelineEndpointTest.php`.
- **Status:** Done

### T-M4-027 — GET /api/v1/citizen/dashboard endpoint
- **Milestone:** M4
- **Title:** GET /api/v1/citizen/dashboard endpoint
- **Description:** Returns `{total, pending, resolved, draft, recent_notifications}` aggregated from `reports` for the authenticated citizen.
- **Related specs:** `docs/05` §6
- **Dependencies:** T-M4-015
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Reports/Http/Controllers/Api/CitizenDashboardController.php`, `backend/app/Modules/Reports/Http/Resources/DashboardResource.php`
- **Acceptance criteria:** Counts are scoped to the citizen; non-citizens get 403.
- **Required tests:** `tests/Feature/Reports/CitizenDashboardEndpointTest.php`.
- **Status:** Done

### T-M4-028 — GET /api/v1/citizen/reports endpoints
- **Milestone:** M4
- **Title:** GET /api/v1/citizen/reports endpoints
- **Description:** `GET /api/v1/citizen/reports` paginated list; `GET /api/v1/citizen/reports/{id}` detail; both use `ReportPolicy`.
- **Related specs:** `docs/05` §6
- **Dependencies:** T-M4-024
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Reports/Http/Controllers/Api/CitizenReportsController.php`
- **Acceptance criteria:** Only the citizen's reports returned; 403 for others.
- **Required tests:** `tests/Feature/Reports/CitizenReportsEndpointTest.php`.
- **Status:** Done

### T-M4-029 — Standardize error codes
- **Milestone:** M4
- **Title:** Standardize error codes
- **Description:** Centralize `REPORT_NOT_FOUND`, `INVALID_GPS`, `VIDEO_REQUIRED`, `PHOTO_REQUIRED`, `DUPLICATE_REPORT`, `INVALID_STATUS` in `ErrorCode` enum and `Exception::render` mapping.
- **Related specs:** `docs/05` §17
- **Dependencies:** T-M4-023
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Shared/Enums/ErrorCode.php`, `backend/app/Modules/Shared/Exceptions/ApiException.php`
- **Acceptance criteria:** Each code is rendered as a stable string in the envelope.
- **Required tests:** `tests/Unit/Shared/ErrorCodeEnumTest.php`.
- **Status:** Done

### T-M4-030 — Document reports API
- **Milestone:** M4
- **Title:** Document reports API
- **Description:** Update `openapi.yaml` with all M4 endpoints and schemas; author `docs/reports.md` with lifecycle, idempotency, and error semantics.
- **Related specs:** `docs/05` §23; `docs/14` §37
- **Dependencies:** T-M4-028
- **Est. time:** 25 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`, `docs/reports.md`
- **Acceptance criteria:** `swagger-cli validate` passes; `docs/reports.md` covers happy + error paths.
- **Required tests:** `tests/Feature/OpenApiReportsTest.php`.
- **Status:** Done

### T-M4-031 — Add Pest suite for citizen submission flow
- **Milestone:** M4
- **Title:** Add Pest suite for citizen submission flow
- **Description:** Cover: create draft, idempotent replay, submit, status history, ownership denial, GPS validation.
- **Related specs:** `docs/15` §7
- **Dependencies:** T-M4-023
- **Est. time:** 30 minutes
- **Files:** `backend/tests/Feature/Reports/CitizenSubmissionFlowTest.php`
- **Acceptance criteria:** All cases green; ≥ 90% line coverage on `Reports/`.
- **Required tests:** `vendor/bin/pest tests/Feature/Reports/CitizenSubmissionFlowTest.php`.
- **Status:** Done

### T-M4-032 — Update README for M4
- **Milestone:** M4
- **Title:** Update README for M4
- **Description:** Add a "Reporting" section with submission flow, idempotency, and the standard error envelope.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M4-030
- **Est. time:** 10 minutes
- **Files:** `README.md`
- **Acceptance criteria:** Section links to `docs/reports.md`.
- **Required tests:** Manual.
- **Status:** Done


---

## Milestone M5 — Media Pipeline & Evidence Integrity

**Source:** `.codex/roadmap.md` §M5. **Specs:** `docs/04` §9, §15, §25; `docs/05` §6, §14, §22; `docs/06` §10–12; `docs/11` §13–15, §32.

---

### T-M5-001 — Create media migration
- **Milestone:** M5
- **Title:** Create media migration
- **Description:** Table `media`: `id` UUID, `report_id` UUID FK, `type` enum(`PHOTO`,`VIDEO`,`DOCUMENT`), `storage_disk`, `storage_path` (unique), `mime`, `size`, `duration` (seconds, nullable), `width` int nullable, `height` int nullable, `checksum` (sha256), `captured_at`, `uploaded_at`, `uploaded_by` UUID FK, `metadata` JSON, `version` int default 1, `is_replaced` bool default false, `timestamps`.
- **Related specs:** `docs/04` §9, §25
- **Dependencies:** T-M4-007
- **Est. time:** 25 minutes
- **Files:** `backend/database/migrations/*_create_media_table.php`
- **Acceptance criteria:** All FKs and unique on `storage_path` enforced.
- **Required tests:** Migration test.
- **Status:** Done

### T-M5-002 — Create media_hashes migration
- **Milestone:** M5
- **Title:** Create media_hashes migration
- **Description:** Table `media_hashes`: `id`, `media_id` UUID FK, `sha256`, `sha512`, `perceptual_hash` (string 16), `video_fingerprint` (string nullable), `created_at`.
- **Related specs:** `docs/04` §9
- **Dependencies:** T-M5-001
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_media_hashes_table.php`
- **Acceptance criteria:** FK to `media`; unique `(media_id, sha256)`.
- **Required tests:** Migration test.
- **Status:** Done

### T-M5-003 — Create Media and MediaHash models
- **Milestone:** M5
- **Title:** Create Media and MediaHash models
- **Description:** `Media` with `HasUuids`; relationship to `Report`; cast `metadata`; `MediaHash` with `belongsTo(Media)`.
- **Related specs:** `docs/04` §9
- **Dependencies:** T-M5-002
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Media/Models/Media.php`, `backend/app/Modules/Media/Models/MediaHash.php`
- **Acceptance criteria:** `$media->hashes` returns the relationship.
- **Required tests:** Model test.
- **Status:** Done

### T-M5-004 — Implement MimeValidator
- **Milestone:** M5
- **Title:** Implement MimeValidator
- **Description:** `MimeValidator::validate(UploadedFile, expectedType): void` checks `getMimeType()` and `getClientMimeType()`; magic bytes sniff; throws `InvalidMediaException` with typed error.
- **Related specs:** `docs/11` §32
- **Dependencies:** T-M1-002
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Media/Services/MimeValidator.php`
- **Acceptance criteria:** A renamed `.php` is rejected; a real JPEG passes.
- **Required tests:** `tests/Unit/Media/MimeValidatorTest.php`.
- **Status:** Done

### T-M5-005 — Implement HashService
- **Milestone:** M5
- **Title:** Implement HashService
- **Description:** `HashService::compute(UploadedFile): array` returns `sha256`, `sha512`, `perceptual_hash` (uses `jenssegers/imagehash` or fallback), `video_fingerprint` (sha1 of frame-byte manifest for now).
- **Related specs:** `docs/04` §9; `docs/11` §14
- **Dependencies:** T-M5-004
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Media/Services/HashService.php`
- **Acceptance criteria:** Same file produces identical hashes.
- **Required tests:** `tests/Unit/Media/HashServiceTest.php`.
- **Status:** Done

### T-M5-006 — Implement VirusScanService interface and LogScanner
- **Milestone:** M5
- **Title:** Implement VirusScanService interface and LogScanner
- **Description:** `VirusScanServiceInterface::scan(path): bool`; `LogScanner` always returns true and logs; `ClamAvScanner` calls `clamscan` binary (stub).
- **Related specs:** `docs/11` §32
- **Dependencies:** T-M5-005
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Media/Contracts/VirusScanServiceInterface.php`, `backend/app/Modules/Media/Services/LogScanner.php`, `backend/app/Modules/Media/Services/ClamAvScanner.php`
- **Acceptance criteria:** `LogScanner` returns true and writes to log; service container binds to `LogScanner` by default.
- **Required tests:** `tests/Unit/Media/LogScannerTest.php`.
- **Status:** Done

### T-M5-007 — Implement ThumbnailService
- **Milestone:** M5
- **Title:** Implement ThumbnailService
- **Description:** `ThumbnailService::generate(Media): string` uses `intervention/image` to produce a 320px JPEG thumbnail into the same disk; returns new path.
- **Related specs:** `docs/03` §15
- **Dependencies:** T-M5-005
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Media/Services/ThumbnailService.php`
- **Acceptance criteria:** Output JPEG is ≤ 50KB; throws on non-image.
- **Required tests:** `tests/Unit/Media/ThumbnailServiceTest.php`.
- **Status:** Done

### T-M5-008 — GenerateThumbnailJob
- **Milestone:** M5
- **Title:** GenerateThumbnailJob
- **Description:** Queue job `GenerateThumbnailJob(mediaId)` calls `ThumbnailService::generate`; on failure, retries 3x then DLQ.
- **Related specs:** `docs/14` §16
- **Dependencies:** T-M5-007
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Media/Jobs/GenerateThumbnailJob.php`
- **Acceptance criteria:** Job dispatches via `Bus::fake` and asserts the call.
- **Required tests:** `tests/Feature/Media/GenerateThumbnailJobTest.php`.
- **Status:** Done

### T-M5-009 — ComputeHashesJob
- **Milestone:** M5
- **Title:** ComputeHashesJob
- **Description:** Queue job `ComputeHashesJob(mediaId)` calls `HashService::compute` and persists to `media_hashes`.
- **Related specs:** `docs/14` §16
- **Dependencies:** T-M5-005
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Media/Jobs/ComputeHashesJob.php`
- **Acceptance criteria:** Job populates all four hash fields.
- **Required tests:** `tests/Feature/Media/ComputeHashesJobTest.php`.
- **Status:** Done

### T-M5-010 — ExtractVideoMetadataJob
- **Milestone:** M5
- **Title:** ExtractVideoMetadataJob
- **Description:** Job that shells out to `ffprobe` (when available) and records `duration`, `width`, `height`; falls back to a stub returning the metadata passed at upload.
- **Related specs:** `docs/05` §14
- **Dependencies:** T-M5-003
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Media/Jobs/ExtractVideoMetadataJob.php`
- **Acceptance criteria:** With a stubbed `ffprobe`, the job writes 320×240 / 4s metadata.
- **Required tests:** `tests/Feature/Media/ExtractVideoMetadataJobTest.php`.
- **Status:** Done

### T-M5-011 — MediaService.upload
- **Milestone:** M5
- **Title:** MediaService.upload
- **Description:** `MediaService::uploadPhoto(reportId, file, uploaderId): Media`; `uploadVideo` similar; rejects on MIME/duration/size; writes to `evidence/{reportUuid}/{type}/{uuid}.{ext}`; never overwrites.
- **Related specs:** `docs/04` §9; `docs/05` §14; `docs/11` §13
- **Dependencies:** T-M5-004, T-M5-006
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Media/Services/MediaService.php`
- **Acceptance criteria:** 11th photo rejected; video <3s or >5s rejected; 16MB photo rejected.
- **Required tests:** `tests/Feature/Media/MediaServiceUploadTest.php`.
- **Status:** Done

### T-M5-012 — POST /api/v1/reports/{id}/photos endpoint
- **Milestone:** M5
- **Title:** POST /api/v1/reports/{id}/photos endpoint
- **Description:** `MediaController@uploadPhotos` accepts `photos[]`; uses `MediaService::uploadPhoto`; returns `MediaResource` array; dispatches `ComputeHashesJob` + `GenerateThumbnailJob`.
- **Related specs:** `docs/05` §6, §14
- **Dependencies:** T-M5-011
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Media/Http/Controllers/Api/MediaController.php`, `backend/app/Modules/Media/Http/Resources/MediaResource.php`
- **Acceptance criteria:** 201 + media array on success; 422 on size/type cap.
- **Required tests:** `tests/Feature/Media/UploadPhotosEndpointTest.php`.
- **Status:** Done

### T-M5-013 — POST /api/v1/reports/{id}/video endpoint
- **Milestone:** M5
- **Title:** POST /api/v1/reports/{id}/video endpoint
- **Description:** `MediaController@uploadVideo` accepts a single `video`; rejects second upload with `VIDEO_ALREADY_PRESENT`; uses `ExtractVideoMetadataJob`; dispatches `ComputeHashesJob`.
- **Related specs:** `docs/05` §6, §14
- **Dependencies:** T-M5-011
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Media/Http/Controllers/Api/MediaController.php`
- **Acceptance criteria:** 201 first upload; 409 second upload; 422 on duration violation.
- **Required tests:** `tests/Feature/Media/UploadVideoEndpointTest.php`.
- **Status:** Done

### T-M5-014 — GET /api/v1/reports/{id}/media endpoint
- **Milestone:** M5
- **Title:** GET /api/v1/reports/{id}/media endpoint
- **Description:** `MediaController@index` returns the media list with `signed_url` (TTL 15 min) for owner/staff; never returns raw storage path to non-staff.
- **Related specs:** `docs/05` §7; `docs/11` §15
- **Dependencies:** T-M5-012
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Media/Http/Controllers/Api/MediaController.php`
- **Acceptance criteria:** Signed URL works within TTL; expired URL returns 403.
- **Required tests:** `tests/Feature/Media/MediaListEndpointTest.php`.
- **Status:** Done

### T-M5-015 — Media signed-URL helper
- **Milestone:** M5
- **Title:** Media signed-URL helper
- **Description:** `MediaUrl::temporary(Media, ttl): string` produces a `Storage::temporaryUrl` (MinIO) or signed route URL fallback.
- **Related specs:** `docs/05` §14
- **Dependencies:** T-M5-014
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Media/Support/MediaUrl.php`
- **Acceptance criteria:** URL is verifiable by Laravel signed route middleware.
- **Required tests:** `tests/Unit/Media/MediaUrlTest.php`.
- **Status:** Done

### T-M5-016 — Chain-of-custody writer
- **Milestone:** M5
- **Title:** Chain-of-custody writer
- **Description:** `ChainOfCustodyWriter::record(Media, $event, $actor)` writes an immutable row capturing capture_time, upload_time, uploader, device, hash, storage_path; on read, supports audit query.
- **Related specs:** `docs/11` §15; `docs/04` §15
- **Dependencies:** T-M5-003
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Media/Services/ChainOfCustodyWriter.php`, `backend/app/Modules/Media/Models/MediaAccessLog.php`, `backend/database/migrations/*_create_media_access_logs_table.php`
- **Acceptance criteria:** Read endpoint is denied for non-staff; access log row present.
- **Required tests:** `tests/Feature/Media/ChainOfCustodyTest.php`.
- **Status:** Done

### T-M5-017 — MediaPolicy
- **Milestone:** M5
- **Title:** MediaPolicy
- **Description:** `MediaPolicy::view` requires report ownership or staff role; `download` is `false` for everyone by default.
- **Related specs:** `docs/11` §15
- **Dependencies:** T-M5-014, T-M2-019
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Media/Policies/MediaPolicy.php`
- **Acceptance criteria:** Anonymous user gets 403.
- **Required tests:** `tests/Feature/Media/MediaPolicyTest.php`.
- **Status:** Done

### T-M5-018 — MinIO bucket init via docker entrypoint
- **Milestone:** M5
- **Title:** MinIO bucket init via docker entrypoint
- **Description:** `docker/minio/entrypoint.sh` waits for MinIO, runs `mc alias`, creates `cip-evidence`, enables versioning + object-lock.
- **Related specs:** `docs/03` §12
- **Dependencies:** T-M1-014
- **Est. time:** 20 minutes
- **Files:** `docker/minio/entrypoint.sh`
- **Acceptance criteria:** `bash -n` passes; script logs bucket creation.
- **Required tests:** Manual.
- **Status:** Done

### T-M5-019 — Media upload limit middleware
- **Milestone:** M5
- **Title:** Media upload limit middleware
- **Description:** `MediaUploadLimit` middleware checks `Content-Length` and aggregate per-user upload bandwidth; returns 413 over 100MB/hour.
- **Related specs:** `docs/11` §21
- **Dependencies:** T-M5-012
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Media/Http/Middleware/MediaUploadLimit.php`
- **Acceptance criteria:** 101MB/hour total returns 413; counter resets hourly.
- **Required tests:** `tests/Feature/Media/UploadLimitMiddlewareTest.php`.
- **Status:** Done

### T-M5-020 — MediaFeatureTest (happy path)
- **Milestone:** M5
- **Title:** MediaFeatureTest (happy path)
- **Description:** Pest feature covering photo upload, video upload, hash persistence, chain-of-custody, signed URL playback.
- **Related specs:** `docs/15` §7
- **Dependencies:** T-M5-015
- **Est. time:** 25 minutes
- **Files:** `backend/tests/Feature/Media/MediaFeatureTest.php`
- **Acceptance criteria:** All cases pass; ≥ 90% line coverage on `Media/`.
- **Required tests:** `vendor/bin/pest tests/Feature/Media/MediaFeatureTest.php`.
- **Status:** Done

### T-M5-021 — MediaFailureTest (rejections)
- **Milestone:** M5
- **Title:** MediaFailureTest (rejections)
- **Description:** Pest feature covering MIME mismatch, oversize photo, video too long/short, 11th photo, second video, expired signed URL.
- **Related specs:** `docs/05` §14; `docs/11` §32
- **Dependencies:** T-M5-015
- **Est. time:** 25 minutes
- **Files:** `backend/tests/Feature/Media/MediaFailureTest.php`
- **Acceptance criteria:** All cases pass with correct error codes.
- **Required tests:** `vendor/bin/pest tests/Feature/Media/MediaFailureTest.php`.
- **Status:** Done

### T-M5-022 — MediaJobTest (queue behavior)
- **Milestone:** M5
- **Title:** MediaJobTest (queue behavior)
- **Description:** Pest test that asserts `ComputeHashesJob`, `GenerateThumbnailJob`, `ExtractVideoMetadataJob` are dispatched and run on the `media` queue.
- **Related specs:** `docs/14` §16
- **Dependencies:** T-M5-010
- **Est. time:** 15 minutes
- **Files:** `backend/tests/Feature/Media/MediaJobTest.php`
- **Acceptance criteria:** `Queue::fake` shows correct job dispatched.
- **Required tests:** `vendor/bin/pest tests/Feature/Media/MediaJobTest.php`.
- **Status:** Done

### T-M5-023 — Update OpenAPI for media endpoints
- **Milestone:** M5
- **Title:** Update OpenAPI for media endpoints
- **Description:** Add `/reports/{id}/photos`, `/reports/{id}/video`, `/reports/{id}/media` to `openapi.yaml` with multipart schemas.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M5-014
- **Est. time:** 20 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `swagger-cli validate` passes.
- **Required tests:** `tests/Feature/OpenApiMediaTest.php`.
- **Status:** Done

### T-M5-024 — Author docs/media.md
- **Milestone:** M5
- **Title:** Author docs/media.md
- **Description:** Document upload limits, hash semantics, chain-of-custody, signed URLs, audit trail, evidence immutability.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M5-023
- **Est. time:** 15 minutes
- **Files:** `docs/media.md`
- **Acceptance criteria:** Doc links to OpenAPI; security section present.
- **Required tests:** Manual.
- **Status:** Done

### T-M5-025 — README update for media
- **Milestone:** M5
- **Title:** README update for media
- **Description:** Add an "Evidence" section to README pointing to `docs/media.md` and explaining MinIO bucket setup.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M5-024
- **Est. time:** 10 minutes
- **Files:** `README.md`
- **Acceptance criteria:** Section includes MinIO init script reference.
- **Required tests:** Manual.
- **Status:** Done

### T-M5-026 — Pin media package versions
- **Milestone:** M5
- **Title:** Pin media package versions
- **Description:** Update `composer.json` with `intervention/image`, `league/flysystem-aws-s3-v3`, `jenssegers/imagehash` (or chosen alt) at pinned versions; verify `composer outdated` clean.
- **Related specs:** `docs/14` §31
- **Dependencies:** T-M5-007
- **Est. time:** 15 minutes
- **Files:** `backend/composer.json`
- **Acceptance criteria:** `composer install` succeeds in CI.
- **Required tests:** `composer install --no-interaction`.
- **Status:** Done


---

## Milestone M6 — Workflow Engine & State Machine

**Source:** `.codex/roadmap.md` §M6. **Specs:** `docs/02` §7; `docs/04` §11; `docs/09` §11; `docs/15` §15.

---

### T-M6-001 — Create workflow_definitions migration
- **Milestone:** M6
- **Title:** Create workflow_definitions migration
- **Description:** Table `workflow_definitions`: `id` UUID, `name`, `code` (unique), `description`, `active`, `timestamps`, `deleted_at`.
- **Related specs:** `docs/04` §11
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_workflow_definitions_table.php`
- **Acceptance criteria:** Migration roundtrips; soft delete column present.
- **Required tests:** Migration test.
- **Status:** Done

### T-M6-002 — Create workflow_states migration
- **Milestone:** M6
- **Title:** Create workflow_states migration
- **Description:** Table `workflow_states`: `id`, `workflow_definition_id` UUID FK, `code`, `name`, `description`, `is_initial` bool, `is_terminal` bool, `sort_order` int, `color`, `active`.
- **Related specs:** `docs/04` §11
- **Dependencies:** T-M6-001
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_workflow_states_table.php`
- **Acceptance criteria:** FK enforced; unique `(workflow_definition_id, code)`.
- **Required tests:** Migration test.
- **Status:** Done

### T-M6-003 — Create workflow_transitions migration
- **Milestone:** M6
- **Title:** Create workflow_transitions migration
- **Description:** Table `workflow_transitions`: `id`, `workflow_definition_id` UUID FK, `from_state_id` UUID FK, `to_state_id` UUID FK, `event` (string), `required_role` (nullable), `required_permission` (nullable), `conditions` JSON, `sla_minutes` int nullable, `notify_before_minutes` int nullable, `priority` int default 0, `active`.
- **Related specs:** `docs/04` §11
- **Dependencies:** T-M6-002
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_workflow_transitions_table.php`
- **Acceptance criteria:** FKs and indexes created; `(from_state_id, event, priority)` index present.
- **Required tests:** Migration test.
- **Status:** Done

### T-M6-004 — Workflow models
- **Milestone:** M6
- **Title:** Workflow models
- **Description:** `WorkflowDefinition`, `WorkflowState`, `WorkflowTransition` Eloquent models with relationships and casts.
- **Related specs:** `docs/04` §11
- **Dependencies:** T-M6-003
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Workflow/Models/WorkflowDefinition.php`, `backend/app/Modules/Workflow/Models/WorkflowState.php`, `backend/app/Modules/Workflow/Models/WorkflowTransition.php`
- **Acceptance criteria:** Relationships return collections.
- **Required tests:** Model test.
- **Status:** Done

### T-M6-005 — WorkflowDecision value object
- **Milestone:** M6
- **Title:** WorkflowDecision value object
- **Description:** Readonly `WorkflowDecision` POPO with `allowed`, `toStateId`, `matchedTransitionId`, `slaMinutes`, `notifyBeforeMinutes`, `reasons` array.
- **Related specs:** `docs/14` §10
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Workflow/ValueObjects/WorkflowDecision.php`
- **Acceptance criteria:** Constructor validates types.
- **Required tests:** Unit test.
- **Status:** Done

### T-M6-006 — ConditionEvaluator service
- **Milestone:** M6
- **Title:** ConditionEvaluator service
- **Description:** `ConditionEvaluator::matches(array $conditions, Report $report, User $actor): bool` evaluates JSON conditions DSL (`eq`, `in`, `gt`, `between`, `truthy`).
- **Related specs:** `docs/04` §11
- **Dependencies:** T-M6-005
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Workflow/Services/ConditionEvaluator.php`
- **Acceptance criteria:** Each operator unit-tested.
- **Required tests:** `tests/Unit/Workflow/ConditionEvaluatorTest.php`.
- **Status:** Done

### T-M6-007 — TransitionGuard service
- **Milestone:** M6
- **Title:** TransitionGuard service
- **Description:** `TransitionGuard::ensure(WorkflowTransition, User, Report): void` checks role, permission, and custom conditions; throws `InvalidTransitionException` or `UnauthorizedTransitionException`.
- **Related specs:** `docs/11` §9
- **Dependencies:** T-M6-006
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Workflow/Services/TransitionGuard.php`
- **Acceptance criteria:** All guards unit-tested.
- **Required tests:** `tests/Unit/Workflow/TransitionGuardTest.php`.
- **Status:** Done

### T-M6-008 — WorkflowEngine.evaluate
- **Milestone:** M6
- **Title:** WorkflowEngine.evaluate
- **Description:** `WorkflowEngine::evaluate(Report, string $event, ?User $actor): WorkflowDecision` returns the highest-priority matching transition or denies with reasons.
- **Related specs:** `docs/04` §11
- **Dependencies:** T-M6-007
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Workflow/Services/WorkflowEngine.php`
- **Acceptance criteria:** Decision determinism verified with seeded data.
- **Required tests:** `tests/Unit/Workflow/WorkflowEngineTest.php`.
- **Status:** Done

### T-M6-009 — WorkflowEngine.apply
- **Milestone:** M6
- **Title:** WorkflowEngine.apply
- **Description:** `WorkflowEngine::apply(Report, $decision, $actor): Report` updates `current_status_id`, emits `ReportStatusChanged` event, writes audit, queues notifications if `sla_minutes` present.
- **Related specs:** `docs/03` §19; `docs/14` §17
- **Dependencies:** T-M6-008, T-M4-018
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Workflow/Services/WorkflowEngine.php`
- **Acceptance criteria:** `apply` is transactional; on failure no state changes.
- **Required tests:** `tests/Feature/Workflow/WorkflowApplyTest.php`.
- **Status:** Done

### T-M6-010 — WorkflowRepository with cache
- **Milestone:** M6
- **Title:** WorkflowRepository with cache
- **Description:** `WorkflowRepository::findActiveByCode(code)` caches `workflow_definitions` and transitions for 1h; invalidates on update.
- **Related specs:** `docs/14` §9
- **Dependencies:** T-M6-004
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Workflow/Repositories/WorkflowRepository.php`
- **Acceptance criteria:** Cache hit on second call; invalidation on definition update.
- **Required tests:** `tests/Feature/Workflow/WorkflowRepositoryTest.php`.
- **Status:** Done

### T-M6-011 — Seed default civic report workflow
- **Milestone:** M6
- **Title:** Seed default civic report workflow
- **Description:** `DefaultWorkflowSeeder` creates the 11-state lifecycle with transitions `submit`, `ai_complete`, `moderator_approve`, `assign`, `accept`, `start`, `resolve`, `verify`, `close`, plus `reject` branch.
- **Related specs:** `docs/02` §7
- **Dependencies:** T-M6-009
- **Est. time:** 30 minutes
- **Files:** `backend/database/seeders/DefaultWorkflowSeeder.php`
- **Acceptance criteria:** A report can traverse every state using `WorkflowEngine::apply`.
- **Required tests:** `tests/Feature/Workflow/DefaultWorkflowTraversalTest.php`.
- **Status:** Done

### T-M6-012 — Wire report submission to workflow
- **Milestone:** M6
- **Title:** Wire report submission to workflow
- **Description:** `ReportService::submit` now calls `WorkflowEngine::evaluate(..., 'submit')` then `apply(...)`; replaces the manual status update from M4.
- **Related specs:** `docs/05` §6
- **Dependencies:** T-M4-017, T-M6-011
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Reports/Services/ReportService.php`
- **Acceptance criteria:** `submit` now sets state to `Submitted` via the engine; history row written.
- **Required tests:** `tests/Feature/Reports/SubmissionUsesWorkflowTest.php`.
- **Status:** Done

### T-M6-013 — /api/v1/admin/workflows CRUD
- **Milestone:** M6
- **Title:** /api/v1/admin/workflows CRUD
- **Description:** `WorkflowAdminController` exposes list, create, update, delete; uses Form Requests; gates via `super_admin`.
- **Related specs:** `docs/09` §11
- **Dependencies:** T-M6-011
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Workflow/Http/Controllers/Admin/WorkflowAdminController.php`, `backend/app/Modules/Workflow/Http/Requests/StoreWorkflowRequest.php`, `backend/app/Modules/Workflow/Http/Requests/UpdateTransitionRequest.php`, `backend/app/Modules/Workflow/Http/Resources/WorkflowResource.php`
- **Acceptance criteria:** Updates invalidate cache; 403 for non-admin.
- **Required tests:** `tests/Feature/Workflow/WorkflowCrudTest.php`.
- **Status:** Done

### T-M6-014 — WorkflowEngine audit writer
- **Milestone:** M6
- **Title:** WorkflowEngine audit writer
- **Description:** `WorkflowEngine::apply` writes an `audit_logs` row with before/after `current_status_id` and `workflow_id`.
- **Related specs:** `docs/03` §19
- **Dependencies:** T-M6-009
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Workflow/Services/WorkflowEngine.php`
- **Acceptance criteria:** Audit row present with `entity='reports'`.
- **Required tests:** `tests/Feature/Workflow/WorkflowAuditTest.php`.
- **Status:** Done

### T-M6-015 — Transition SLA timer job
- **Milestone:** M6
- **Title:** Transition SLA timer job
- **Description:** `CheckSlaBreaches` scheduled job (every 5 min) finds reports whose transition SLA has passed without progression; emits `SlaBreached` event.
- **Related specs:** `docs/03` §9
- **Dependencies:** T-M6-009
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Workflow/Jobs/CheckSlaBreaches.php`
- **Acceptance criteria:** Reports past SLA raise event; non-breaching reports are skipped.
- **Required tests:** `tests/Feature/Workflow/CheckSlaBreachesTest.php`.
- **Status:** Done

### T-M6-016 — WorkflowFeatureTest (every transition)
- **Milestone:** M6
- **Title:** WorkflowFeatureTest (every transition)
- **Description:** Pest feature covering every valid transition in the default workflow plus invalid transition denials.
- **Related specs:** `docs/15` §15
- **Dependencies:** T-M6-011
- **Est. time:** 30 minutes
- **Files:** `backend/tests/Feature/Workflow/EveryTransitionTest.php`
- **Acceptance criteria:** All transitions green; illegal transitions return `INVALID_STATUS`.
- **Required tests:** `vendor/bin/pest tests/Feature/Workflow/EveryTransitionTest.php`.
- **Status:** Done

### T-M6-017 — WorkflowRoleEnforcementTest
- **Milestone:** M6
- **Title:** WorkflowRoleEnforcementTest
- **Description:** Pest feature asserting that a `citizen` cannot trigger `assign` and a `department_officer` cannot trigger `moderator_approve`.
- **Related specs:** `docs/11` §9
- **Dependencies:** T-M6-007
- **Est. time:** 20 minutes
- **Files:** `backend/tests/Feature/Workflow/RoleEnforcementTest.php`
- **Acceptance criteria:** All denials return `UnauthorizedTransitionException` mapped to 403.
- **Required tests:** `vendor/bin/pest tests/Feature/Workflow/RoleEnforcementTest.php`.
- **Status:** Done

### T-M6-018 — WorkflowConditionTest
- **Milestone:** M6
- **Title:** WorkflowConditionTest
- **Description:** Pest test covering every operator in `ConditionEvaluator` and combined boolean expressions.
- **Related specs:** `docs/04` §11
- **Dependencies:** T-M6-006
- **Est. time:** 20 minutes
- **Files:** `backend/tests/Unit/Workflow/ConditionEvaluatorTest.php`
- **Acceptance criteria:** All cases pass.
- **Required tests:** `vendor/bin/pest tests/Unit/Workflow/ConditionEvaluatorTest.php`.
- **Status:** Done

### T-M6-019 — Update OpenAPI for workflow admin
- **Milestone:** M6
- **Title:** Update OpenAPI for workflow admin
- **Description:** Add admin endpoints + `WorkflowResource` schema to `openapi.yaml`.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M6-013
- **Est. time:** 15 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `swagger-cli validate` passes.
- **Required tests:** `tests/Feature/OpenApiWorkflowTest.php`.
- **Status:** Done

### T-M6-020 — Author docs/workflow.md
- **Milestone:** M6
- **Title:** Author docs/workflow.md
- **Description:** Document state machine, transitions, conditions DSL, role/permission enforcement, SLA timers, and cache invalidation.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M6-019
- **Est. time:** 20 minutes
- **Files:** `docs/workflow.md`
- **Acceptance criteria:** Each transition listed with event and required role.
- **Required tests:** Manual.
- **Status:** Done

### T-M6-021 — README section for workflow
- **Milestone:** M6
- **Title:** README section for workflow
- **Description:** Add "Workflow" section linking to `docs/workflow.md` and showing the default lifecycle ASCII art.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M6-020
- **Est. time:** 10 minutes
- **Files:** `README.md`
- **Acceptance criteria:** ASCII diagram renders in markdown preview.
- **Required tests:** Manual.
- **Status:** Done

### T-M6-022 — Wire CheckSlaBreaches into scheduler
- **Milestone:** M6
- **Title:** Wire CheckSlaBreaches into scheduler
- **Description:** Register the job in `app/Console/Kernel.php` to run every 5 minutes; document in `docs/workflow.md`.
- **Related specs:** `docs/14` §3
- **Dependencies:** T-M6-015
- **Est. time:** 10 minutes
- **Files:** `backend/app/Console/Kernel.php`
- **Acceptance criteria:** `php artisan schedule:list` shows the job.
- **Required tests:** `tests/Feature/Workflow/SchedulerRegistrationTest.php`.
- **Status:** Done


---

## Milestone M7 — Routing Engine & Department Assignment

**Source:** `.codex/roadmap.md` §M7. **Specs:** `docs/02` §12; `docs/04` §12; `docs/09` §12; `docs/08` §8.

---

### T-M7-001 — Create routing_rules migration
- **Milestone:** M7
- **Title:** Create routing_rules migration
- **Description:** Table `routing_rules`: `id` UUID, `name`, `priority` int, `conditions` JSON, `destination_department_id` UUID FK, `default_officer_id` UUID nullable, `default_priority_id` UUID FK, `default_sla_minutes` int, `active` bool, `description`, `timestamps`, `deleted_at`.
- **Related specs:** `docs/04` §12
- **Dependencies:** T-M3-007, T-M4-004
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_routing_rules_table.php`
- **Acceptance criteria:** FKs and `priority` index created.
- **Required tests:** Migration test.
- **Status:** Done

### T-M7-002 — RoutingRule model
- **Milestone:** M7
- **Title:** RoutingRule model
- **Description:** `RoutingRule` model with `HasUuids`, `SoftDeletes`, `casts['conditions' => 'array']`, relationships to `Department`, `ReportPriority`.
- **Related specs:** `docs/04` §12
- **Dependencies:** T-M7-001
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Routing/Models/RoutingRule.php`
- **Acceptance criteria:** `$rule->destinationDepartment` returns Department.
- **Required tests:** Model test.
- **Status:** Done

### T-M7-003 — RoutingCondition DSL parser
- **Milestone:** M7
- **Title:** RoutingCondition DSL parser
- **Description:** `RoutingCondition::evaluate(array $conditions, Report $report): bool` supports `category_in`, `ward_in`, `district_in`, `severity_in`, `keyword_match`, `time_of_day_between`, `ai_label_in`, boolean `and`/`or`.
- **Related specs:** `docs/04` §12
- **Dependencies:** T-M7-002
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Routing/Services/RoutingCondition.php`
- **Acceptance criteria:** Each operator unit-tested.
- **Required tests:** `tests/Unit/Routing/RoutingConditionTest.php`.
- **Status:** Done

### T-M7-004 — RoutingEngine.resolve
- **Milestone:** M7
- **Title:** RoutingEngine.resolve
- **Description:** `RoutingEngine::resolve(Report): ?RoutingDecision` evaluates rules in ascending `priority`; first match wins; returns DTO with department, officer, priority, sla.
- **Related specs:** `docs/04` §12
- **Dependencies:** T-M7-003
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Routing/Services/RoutingEngine.php`, `backend/app/Modules/Routing/ValueObjects/RoutingDecision.php`
- **Acceptance criteria:** Determinism test: same input → same decision.
- **Required tests:** `tests/Unit/Routing/RoutingEngineTest.php`.
- **Status:** Done

### T-M7-005 — AssignmentService
- **Milestone:** M7
- **Title:** AssignmentService
- **Description:** `AssignmentService::assign(Report, RoutingDecision, $actor): ReportAssignment` picks an officer (round-robin or load-balanced) and writes a `report_assignments` row.
- **Related specs:** `docs/04` §12
- **Dependencies:** T-M4-010
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Routing/Services/AssignmentService.php`
- **Acceptance criteria:** Round-robin assignment deterministically cycles.
- **Required tests:** `tests/Feature/Routing/AssignmentServiceTest.php`.
- **Status:** Done

### T-M7-006 — ReportAssigned event
- **Milestone:** M7
- **Title:** ReportAssigned event
- **Description:** `ReportAssigned` immutable event; emitted by `AssignmentService::assign`; payload includes report_id, department_id, officer_id, sla_minutes.
- **Related specs:** `docs/03` §16
- **Dependencies:** T-M7-005
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Reports/Events/ReportAssigned.php`
- **Acceptance criteria:** Event dispatched and serializable.
- **Required tests:** `tests/Feature/Reports/ReportAssignedEventTest.php`.
- **Status:** Done

### T-M7-007 — Wire report to routing after AI complete
- **Milestone:** M7
- **Title:** Wire report to routing after AI complete
- **Description:** `AiCompletedListener` calls `RoutingEngine::resolve` and `AssignmentService::assign`; emits `ReportAssigned`; transitions workflow to `Assigned` (skipped if no decision → Super Admin moderation).
- **Related specs:** `docs/02` §12
- **Dependencies:** T-M7-006, T-M6-009
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/AI/Listeners/AiCompletedListener.php`
- **Acceptance criteria:** End-to-end: AI completion → routing → assignment → status Assigned.
- **Required tests:** `tests/Feature/Routing/RoutingFlowTest.php`.
- **Status:** Done

### T-M7-008 — Routing fallback queue
- **Milestone:** M7
- **Title:** Routing fallback queue
- **Description:** When no rule matches, the report is assigned to a configured "default" Super Admin moderation queue (configurable via `app_configs` key `routing_default_department_id`).
- **Related specs:** `docs/09` §18
- **Dependencies:** T-M7-007
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Routing/Services/RoutingEngine.php`
- **Acceptance criteria:** Missing config throws `ROUTING_FALLBACK_MISSING`; configured fallback assigns correctly.
- **Required tests:** `tests/Feature/Routing/RoutingFallbackTest.php`.
- **Status:** Done

### T-M7-009 — /api/v1/admin/routing CRUD
- **Milestone:** M7
- **Title:** /api/v1/admin/routing CRUD
- **Description:** `RoutingAdminController` exposes list/create/update/delete/reorder; gates to `super_admin`.
- **Related specs:** `docs/09` §12
- **Dependencies:** T-M7-008
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Routing/Http/Controllers/Admin/RoutingAdminController.php`, `backend/app/Modules/Routing/Http/Requests/StoreRoutingRuleRequest.php`, `backend/app/Modules/Routing/Http/Resources/RoutingRuleResource.php`
- **Acceptance criteria:** Reorder endpoint accepts `priority` updates and persists.
- **Required tests:** `tests/Feature/Routing/RoutingCrudTest.php`.
- **Status:** Done

### T-M7-010 — RoutingReassign endpoint
- **Milestone:** M7
- **Title:** RoutingReassign endpoint
- **Description:** `POST /api/v1/admin/reports/{id}/reassign` body `{department_id, officer_id, reason}`; writes new `report_assignments`, revokes previous, emits event.
- **Related specs:** `docs/04` §12
- **Dependencies:** T-M7-009
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Routing/Http/Controllers/Admin/ReassignController.php`
- **Acceptance criteria:** Old assignment marked `reassigned_at`; new one active.
- **Required tests:** `tests/Feature/Routing/ReassignTest.php`.
- **Status:** Done

### T-M7-011 — Seed Bangalore sample routing rules
- **Milestone:** M7
- **Title:** Seed Bangalore sample routing rules
- **Description:** `RoutingRulesSeeder` inserts the three documented sample rules (Garbage→BBMP Ward 112, Pothole→BBMP Ward 112, Illegal Parking→BTP).
- **Related specs:** `docs/02` §12
- **Dependencies:** T-M7-009
- **Est. time:** 20 minutes
- **Files:** `backend/database/seeders/RoutingRulesSeeder.php`
- **Acceptance criteria:** 3 rules present; `resolve` returns the correct department for the seeded reports.
- **Required tests:** `tests/Feature/Routing/RoutingSeedTest.php`.
- **Status:** Done

### T-M7-012 — RoutingDeterminismTest
- **Milestone:** M7
- **Title:** RoutingDeterminismTest
- **Description:** Pest test that calls `resolve` 50 times for the same input and asserts identical results; also asserts first-match ordering.
- **Related specs:** `docs/15` §15
- **Dependencies:** T-M7-011
- **Est. time:** 15 minutes
- **Files:** `backend/tests/Feature/Routing/RoutingDeterminismTest.php`
- **Acceptance criteria:** 50 calls return identical decisions.
- **Required tests:** `vendor/bin/pest tests/Feature/Routing/RoutingDeterminismTest.php`.
- **Status:** Done

### T-M7-013 — RoutingConditionFullTest
- **Milestone:** M7
- **Title:** RoutingConditionFullTest
- **Description:** Pest test for every DSL operator + combined `and`/`or`; missing condition = pass; nested arrays.
- **Related specs:** `docs/04` §12
- **Dependencies:** T-M7-003
- **Est. time:** 25 minutes
- **Files:** `backend/tests/Unit/Routing/RoutingConditionFullTest.php`
- **Acceptance criteria:** ≥ 30 cases pass.
- **Required tests:** `vendor/bin/pest tests/Unit/Routing/RoutingConditionFullTest.php`.
- **Status:** Done

### T-M7-014 — Update OpenAPI for routing admin
- **Milestone:** M7
- **Title:** Update OpenAPI for routing admin
- **Description:** Add admin endpoints to `openapi.yaml`; document condition DSL via a JSON schema.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M7-009
- **Est. time:** 20 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `swagger-cli validate` passes.
- **Required tests:** `tests/Feature/OpenApiRoutingTest.php`.
- **Status:** Done

### T-M7-015 — Author docs/routing.md
- **Milestone:** M7
- **Title:** Author docs/routing.md
- **Description:** Document the DSL, rule ordering, fallback behavior, and reassignment workflow.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M7-014
- **Est. time:** 20 minutes
- **Files:** `docs/routing.md`
- **Acceptance criteria:** Doc has a working example for each operator.
- **Required tests:** Manual.
- **Status:** Done

### T-M7-016 — README section for routing
- **Milestone:** M7
- **Title:** README section for routing
- **Description:** Add "Routing" section pointing to `docs/routing.md`.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M7-015
- **Est. time:** 10 minutes
- **Files:** `README.md`
- **Acceptance criteria:** Section has anchor link.
- **Required tests:** Manual.
- **Status:** Done

### T-M7-017 — RoutingRepository cache
- **Milestone:** M7
- **Title:** RoutingRepository cache
- **Description:** `RoutingRepository::activeRules()` caches `routing_rules` for 1h; cache tags `routing`; cleared on CRUD.
- **Related specs:** `docs/14` §9
- **Dependencies:** T-M7-009
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Routing/Repositories/RoutingRepository.php`
- **Acceptance criteria:** Cache hit verified; CRUD clears cache.
- **Required tests:** `tests/Feature/Routing/RoutingRepositoryTest.php`.
- **Status:** Done

### T-M7-018 — RoutingAdminAuditTest
- **Milestone:** M7
- **Title:** RoutingAdminAuditTest
- **Description:** Pest feature asserting every CRUD on routing writes an `audit_logs` row.
- **Related specs:** `docs/03` §19
- **Dependencies:** T-M7-009
- **Est. time:** 15 minutes
- **Files:** `backend/tests/Feature/Routing/RoutingAuditTest.php`
- **Acceptance criteria:** 5 writes → 5 audit rows.
- **Required tests:** `vendor/bin/pest tests/Feature/Routing/RoutingAuditTest.php`.
- **Status:** Done


---

## Milestone M8 — AI Vision Pipeline & Provider Abstraction

**Source:** `.codex/roadmap.md` §M8. **Specs:** `docs/03` §7; `docs/10` (entire); `docs/04` §10; `docs/05` §11; `docs/11` §28.

---

### T-M8-001 — Create ai_provider_configs migration
- **Milestone:** M8
- **Title:** Create ai_provider_configs migration
- **Description:** Table `ai_provider_configs`: `id` UUID, `code` (unique), `name`, `base_url`, `auth_type`, `api_key_secret_id` UUID nullable, `model`, `temperature` decimal, `timeout_ms`, `retry_count`, `is_fallback` bool, `priority` int, `active`, `timestamps`.
- **Related specs:** `docs/04` §10; `docs/10` §29
- **Dependencies:** T-M1-002
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_ai_provider_configs_table.php`
- **Acceptance criteria:** FKs and unique `code` enforced.
- **Required tests:** Migration test.
- **Status:** Done

### T-M8-002 — Create prompt_versions migration
- **Milestone:** M8
- **Title:** Create prompt_versions migration
- **Description:** Table `prompt_versions`: `id` UUID, `name` (e.g. `category_classifier`), `version` int, `purpose`, `provider_code`, `prompt_text` (text), `expected_json_schema` JSON, `status` enum(`draft`,`approved`,`deprecated`), `approved_by` UUID nullable, `approved_at` nullable, `timestamps`; unique `(name, version)`.
- **Related specs:** `docs/10` §15
- **Dependencies:** T-M8-001
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_prompt_versions_table.php`
- **Acceptance criteria:** Migration roundtrips.
- **Required tests:** Migration test.
- **Status:** Done

### T-M8-003 — Create ai_jobs migration
- **Milestone:** M8
- **Title:** Create ai_jobs migration
- **Description:** Table `ai_jobs`: `id` UUID, `report_id` UUID FK, `prompt_version_id` UUID FK, `provider_code`, `model`, `status` enum(`queued`,`running`,`succeeded`,`failed`,`timeout`), `requested_at`, `started_at`, `completed_at`, `processing_time_ms`, `error_code` nullable, `retry_count` int default 0, `tokens_in`, `tokens_out`, `cost_cents` int.
- **Related specs:** `docs/04` §10
- **Dependencies:** T-M8-002
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_ai_jobs_table.php`
- **Acceptance criteria:** Indexes on `(status)`, `(report_id)`.
- **Required tests:** Migration test.
- **Status:** Done

### T-M8-004 — Create ai_results migration
- **Milestone:** M8
- **Title:** Create ai_results migration
- **Description:** Table `ai_results`: `id`, `job_id` UUID FK, `predicted_type` string, `confidence` decimal, `recommended_department` string, `severity` string, `quality_score` int, `duplicate_score` int, `fraud_score` int, `summary` text, `raw_response` JSON, `created_at`.
- **Related specs:** `docs/04` §10; `docs/10` §14
- **Dependencies:** T-M8-003
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_ai_results_table.php`
- **Acceptance criteria:** Migration roundtrips.
- **Required tests:** Migration test.
- **Status:** Done

### T-M8-005 — Create ai_labels migration
- **Milestone:** M8
- **Title:** Create ai_labels migration
- **Description:** Table `ai_labels`: `id`, `result_id` UUID FK, `label` string, `confidence` decimal, `is_primary` bool, `created_at`.
- **Related specs:** `docs/04` §10; `docs/10` §11
- **Dependencies:** T-M8-004
- **Est. time:** 10 minutes
- **Files:** `backend/database/migrations/*_create_ai_labels_table.php`
- **Acceptance criteria:** Migration roundtrips.
- **Required tests:** Migration test.
- **Status:** Done

### T-M8-006 — AI Eloquent models
- **Milestone:** M8
- **Title:** AI Eloquent models
- **Description:** `AiProviderConfig`, `PromptVersion`, `AiJob`, `AiResult`, `AiLabel` models with relationships and casts.
- **Related specs:** `docs/04` §10
- **Dependencies:** T-M8-005
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/AI/Models/AiProviderConfig.php`, `backend/app/Modules/AI/Models/PromptVersion.php`, `backend/app/Modules/AI/Models/AiJob.php`, `backend/app/Modules/AI/Models/AiResult.php`, `backend/app/Modules/AI/Models/AiLabel.php`
- **Acceptance criteria:** Relationships return collections.
- **Required tests:** Model test.
- **Status:** Done

### T-M8-007 — AIProviderInterface
- **Milestone:** M8
- **Title:** AIProviderInterface
- **Description:** Define `AIProviderInterface` with `analyzeImage`, `analyzeVideo`, `classify`, `summarize`, `healthCheck`, `getName`, `getModel`; provider-agnostic value object `AiRequest`/`AiResponse`.
- **Related specs:** `docs/10` §6, §14
- **Dependencies:** T-M8-006
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/AI/Contracts/AIProviderInterface.php`, `backend/app/Modules/AI/ValueObjects/AiRequest.php`, `backend/app/Modules/AI/ValueObjects/AiResponse.php`
- **Acceptance criteria:** Interface enforced by a Pest test.
- **Required tests:** `tests/Unit/AI/AIProviderInterfaceTest.php`.
- **Status:** Done

### T-M8-008 — MockProvider implementation
- **Milestone:** M8
- **Title:** MockProvider implementation
- **Description:** `MockProvider` returns deterministic responses based on a fixture file; no network; used in tests and dev seed.
- **Related specs:** `docs/10` §6
- **Dependencies:** T-M8-007
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/AI/Providers/MockProvider.php`, `backend/tests/fixtures/ai/mock_responses.json`
- **Acceptance criteria:** Provider roundtrips with deterministic output.
- **Required tests:** `tests/Feature/AI/MockProviderTest.php`.
- **Status:** Done

### T-M8-009 — OpenAICompatibleProvider
- **Milestone:** M8
- **Title:** OpenAICompatibleProvider
- **Description:** `OpenAICompatibleProvider` calls the OpenAI Chat Completions /images.anthropic endpoints with a configurable base URL; supports Qwen-VL style multi-image messages.
- **Related specs:** `docs/10` §6
- **Dependencies:** T-M8-007
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/AI/Providers/OpenAICompatibleProvider.php`
- **Acceptance criteria:** Health check returns false on 4xx; happy path returns parsed JSON.
- **Required tests:** `tests/Feature/AI/OpenAICompatibleProviderTest.php` (with `Http::fake`).
- **Status:** Done

### T-M8-010 — QwenVLProvider adapter
- **Milestone:** M8
- **Title:** QwenVLProvider adapter
- **Description:** `QwenVLProvider` extends `OpenAICompatibleProvider` with Qwen-VL defaults (model `qwen-vl-plus`, temperature 0.2).
- **Related specs:** `docs/10` §7
- **Dependencies:** T-M8-009
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/AI/Providers/QwenVLProvider.php`
- **Acceptance criteria:** Provider selected by `code=qwen-vl`.
- **Required tests:** `tests/Feature/AI/QwenVLProviderTest.php`.
- **Status:** Not Started

### T-M8-011 — PiiMaskingService
- **Milestone:** M8
- **Title:** PiiMaskingService
- **Description:** `PiiMaskingService::mask(array $payload): array` strips `mobile`, `email`, `token`, exact lat/lng (rounded to 2 decimals), `address`; logs masking events.
- **Related specs:** `docs/11` §28
- **Dependencies:** T-M1-002
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/AI/Services/PiiMaskingService.php`
- **Acceptance criteria:** No mobile/email survives the mask.
- **Required tests:** `tests/Unit/AI/PiiMaskingServiceTest.php`.
- **Status:** Not Started

### T-M8-012 — ImageQualityAnalyzer
- **Milestone:** M8
- **Title:** ImageQualityAnalyzer
- **Description:** `ImageQualityAnalyzer::score(Media): int` returns 0–100 based on blur, exposure, size heuristics; flags < 50 for moderator review.
- **Related specs:** `docs/10` §9
- **Dependencies:** T-M5-005
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/AI/Services/ImageQualityAnalyzer.php`
- **Acceptance criteria:** Solid black image scores 0; clean street photo scores > 80.
- **Required tests:** `tests/Unit/AI/ImageQualityAnalyzerTest.php`.
- **Status:** Not Started

### T-M8-013 — DuplicateDetector
- **Milestone:** M8
- **Title:** DuplicateDetector
- **Description:** `DuplicateDetector::score(Report): int` combines perceptual hash distance, embedding similarity (cached), and time-window signal; returns 0–100.
- **Related specs:** `docs/10` §20
- **Dependencies:** T-M5-005
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/AI/Services/DuplicateDetector.php`
- **Acceptance criteria:** Identical hash → 100; distance > 5 → 0.
- **Required tests:** `tests/Unit/AI/DuplicateDetectorTest.php`.
- **Status:** Not Started

### T-M8-014 — FraudScorer
- **Milestone:** M8
- **Title:** FraudScorer
- **Description:** `FraudScorer::score(Report, securityEvents): int` aggregates mock-GPS, replay, AI-synth, repeated device, rate-limit signals; returns 0–100.
- **Related specs:** `docs/10` §21
- **Dependencies:** T-M2-021
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/AI/Services/FraudScorer.php`
- **Acceptance criteria:** Mock-GPS signal of 0.9 pushes score > 75.
- **Required tests:** `tests/Unit/AI/FraudScorerTest.php`.
- **Status:** Not Started

### T-M8-015 — ConfidenceAggregator
- **Milestone:** M8
- **Title:** ConfidenceAggregator
- **Description:** `ConfidenceAggregator::decide(int $confidence): string` returns `auto_route` (>95), `moderator_review` (80-95), `manual_classification` (<80); thresholds config-driven.
- **Related specs:** `docs/10` §13
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/AI/Services/ConfidenceAggregator.php`
- **Acceptance criteria:** Boundary cases map to expected buckets.
- **Required tests:** `tests/Unit/AI/ConfidenceAggregatorTest.php`.
- **Status:** Not Started

### T-M8-016 — AiResponseValidator
- **Milestone:** M8
- **Title:** AiResponseValidator
- **Description:** `AiResponseValidator::validate(AiResponse): void` enforces the JSON schema in `docs/10` §14; throws `InvalidAiResponseException`.
- **Related specs:** `docs/10` §14
- **Dependencies:** T-M8-007
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/AI/Services/AiResponseValidator.php`
- **Acceptance criteria:** Missing `category` raises; wrong types raise.
- **Required tests:** `tests/Unit/AI/AiResponseValidatorTest.php`.
- **Status:** Not Started

### T-M8-017 — ProviderFailoverService
- **Milestone:** M8
- **Title:** ProviderFailoverService
- **Description:** `ProviderFailoverService::execute(AiRequest): AiResponse` iterates `ai_provider_configs` in `priority` order; retries with exponential backoff; on exhaustion, returns failure.
- **Related specs:** `docs/10` §27
- **Dependencies:** T-M8-009
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/AI/Services/ProviderFailoverService.php`
- **Acceptance criteria:** First provider 503 → second provider succeeds.
- **Required tests:** `tests/Feature/AI/ProviderFailoverTest.php`.
- **Status:** Not Started

### T-M8-018 — AiPipelineOrchestrator job
- **Milestone:** M8
- **Title:** AiPipelineOrchestrator job
- **Description:** `AiPipelineOrchestrator(ReportId)` job chains: quality → OCR (stub) → vision → duplicate → fraud → category → severity → department → summary; writes `ai_jobs` and `ai_results`; emits `AICompleted`.
- **Related specs:** `docs/10` §8
- **Dependencies:** T-M8-012, T-M8-013, T-M8-014, T-M8-016, T-M8-017
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/AI/Jobs/AiPipelineOrchestrator.php`
- **Acceptance criteria:** End-to-end with `MockProvider` produces a persisted `AiResult` matching schema.
- **Required tests:** `tests/Feature/AI/PipelineOrchestratorTest.php`.
- **Status:** Not Started

### T-M8-019 — AICompleted event
- **Milestone:** M8
- **Title:** AICompleted event
- **Description:** `AICompleted` event carries `report_id`, `ai_job_id`, `confidence`, `category`, `severity`, `department`; emitted by `AiPipelineOrchestrator`.
- **Related specs:** `docs/03` §16
- **Dependencies:** T-M8-018
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/AI/Events/AICompleted.php`
- **Acceptance criteria:** Event serializable; listener receives payload.
- **Required tests:** `tests/Feature/AI/AICompletedEventTest.php`.
- **Status:** Not Started

### T-M8-020 — Dispatch pipeline on report submit
- **Milestone:** M8
- **Title:** Dispatch pipeline on report submit
- **Description:** `ReportSubmittedListener` dispatches `AiPipelineOrchestrator`; on failure, marks report as `AI_FAILED` and routes to moderator.
- **Related specs:** `docs/05` §6
- **Dependencies:** T-M8-019, T-M4-018
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/AI/Listeners/ReportSubmittedListener.php`
- **Acceptance criteria:** Submitting a report creates an `ai_jobs` row.
- **Required tests:** `tests/Feature/AI/ReportSubmitTriggersAiTest.php`.
- **Status:** Not Started

### T-M8-021 — POST /api/v1/internal/ai/process
- **Milestone:** M8
- **Title:** POST /api/v1/internal/ai/process
- **Description:** `InternalAiController@process` enqueues `AiPipelineOrchestrator`; returns `202` + `job_id`; requires `system` role.
- **Related specs:** `docs/05` §11
- **Dependencies:** T-M8-020
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/AI/Http/Controllers/Internal/InternalAiController.php`
- **Acceptance criteria:** 202 with job id; 403 for non-system.
- **Required tests:** `tests/Feature/AI/InternalProcessEndpointTest.php`.
- **Status:** Not Started

### T-M8-022 — GET /api/v1/internal/ai/job/{id}
- **Milestone:** M8
- **Title:** GET /api/v1/internal/ai/job/{id}
- **Description:** `InternalAiController@job` returns job status; uses `AiJobResource`.
- **Related specs:** `docs/05` §11
- **Dependencies:** T-M8-021
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/AI/Http/Controllers/Internal/InternalAiController.php`, `backend/app/Modules/AI/Http/Resources/AiJobResource.php`
- **Acceptance criteria:** 200 with job fields; 404 if missing.
- **Required tests:** `tests/Feature/AI/InternalJobEndpointTest.php`.
- **Status:** Not Started

### T-M8-023 — GET /api/v1/internal/ai/job/{id}/result
- **Milestone:** M8
- **Title:** GET /api/v1/internal/ai/job/{id}/result
- **Description:** Returns the `AiResult` and labels; 404 if not yet produced.
- **Related specs:** `docs/05` §11
- **Dependencies:** T-M8-022
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/AI/Http/Controllers/Internal/InternalAiController.php`, `backend/app/Modules/AI/Http/Resources/AiResultResource.php`
- **Acceptance criteria:** 200 with result; 404 if not yet.
- **Required tests:** `tests/Feature/AI/InternalResultEndpointTest.php`.
- **Status:** Not Started

### T-M8-024 — /api/v1/admin/ai/providers CRUD
- **Milestone:** M8
- **Title:** /api/v1/admin/ai/providers CRUD
- **Description:** `AiProviderAdminController` exposes list/create/update/delete; uses `AiProviderConfigResource`; masks secrets in responses.
- **Related specs:** `docs/09` §13
- **Dependencies:** T-M8-006
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/AI/Http/Controllers/Admin/AiProviderAdminController.php`, `backend/app/Modules/AI/Http/Requests/StoreAiProviderRequest.php`, `backend/app/Modules/AI/Http/Resources/AiProviderConfigResource.php`
- **Acceptance criteria:** Secrets never serialized; CRUD works.
- **Required tests:** `tests/Feature/AI/AiProviderCrudTest.php`.
- **Status:** Not Started

### T-M8-025 — /api/v1/admin/ai/prompts CRUD with version rollback
- **Milestone:** M8
- **Title:** /api/v1/admin/ai/prompts CRUD with version rollback
- **Description:** `AiPromptAdminController` exposes CRUD plus `POST /prompts/{id}/rollback`; bumping version increments and deprecates previous.
- **Related specs:** `docs/10` §15
- **Dependencies:** T-M8-024
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/AI/Http/Controllers/Admin/AiPromptAdminController.php`, `backend/app/Modules/AI/Http/Requests/StorePromptRequest.php`, `backend/app/Modules/AI/Http/Resources/PromptVersionResource.php`
- **Acceptance criteria:** New version deprecates old; rollback restores.
- **Required tests:** `tests/Feature/AI/AiPromptCrudTest.php`.
- **Status:** Not Started

### T-M8-026 — Seed default prompt versions
- **Milestone:** M8
- **Title:** Seed default prompt versions
- **Description:** `PromptsSeeder` inserts the base system prompt, category prompt, and severity prompt from `docs/10` §16–17 as approved v1.
- **Related specs:** `docs/10` §16, §17
- **Dependencies:** T-M8-025
- **Est. time:** 20 minutes
- **Files:** `backend/database/seeders/PromptsSeeder.php`
- **Acceptance criteria:** 3 prompts present; active version is v1.
- **Required tests:** Seed test.
- **Status:** Not Started

### T-M8-027 — Seed Mock provider as default
- **Milestone:** M8
- **Title:** Seed Mock provider as default
- **Description:** `AiProvidersSeeder` inserts `mock` as the highest-priority active provider in dev/test; inserts `qwen-vl` as a placeholder (inactive until configured).
- **Related specs:** `docs/10` §7
- **Dependencies:** T-M8-024
- **Est. time:** 15 minutes
- **Files:** `backend/database/seeders/AiProvidersSeeder.php`
- **Acceptance criteria:** Mock is default in dev env.
- **Required tests:** Seed test.
- **Status:** Not Started

### T-M8-028 — AiBenchmarkSuite
- **Milestone:** M8
- **Title:** AiBenchmarkSuite
- **Description:** Pest suite running `MockProvider` against a 50-image fixture and asserting each result validates against `docs/10` §14 schema.
- **Related specs:** `docs/15` §14
- **Dependencies:** T-M8-008
- **Est. time:** 30 minutes
- **Files:** `backend/tests/Feature/AI/AiBenchmarkTest.php`
- **Acceptance criteria:** All 50 cases pass schema validation.
- **Required tests:** `vendor/bin/pest tests/Feature/AI/AiBenchmarkTest.php`.
- **Status:** Not Started

### T-M8-029 — Update OpenAPI for AI
- **Milestone:** M8
- **Title:** Update OpenAPI for AI
- **Description:** Add internal AI endpoints and admin provider/prompt endpoints to `openapi.yaml`.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M8-025
- **Est. time:** 20 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `swagger-cli validate` passes.
- **Required tests:** `tests/Feature/OpenApiAiTest.php`.
- **Status:** Not Started

### T-M8-030 — Author docs/ai.md
- **Milestone:** M8
- **Title:** Author docs/ai.md
- **Description:** Document provider abstraction, prompt lifecycle, confidence rules, PII masking, failover, benchmark suite.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M8-029
- **Est. time:** 25 minutes
- **Files:** `docs/ai.md`
- **Acceptance criteria:** Doc explains how to add a provider without code changes.
- **Required tests:** Manual.
- **Status:** Not Started


---

## Milestone M9 — Notification & Eventing Platform

**Source:** `.codex/roadmap.md` §M9. **Specs:** `docs/02` §14; `docs/03` §17; `docs/04` §13; `docs/05` §12; `docs/11` §26.

---

### T-M9-001 — Create notifications migration
- **Milestone:** M9
- **Title:** Create notifications migration
- **Description:** Table `notifications`: `id` UUID, `user_id` UUID FK, `type`, `channel` enum(`push`,`email`,`sms`,`webhook`), `payload` JSON, `status` enum(`pending`,`sent`,`failed`,`dead`), `read_at` nullable, `scheduled_at` nullable, `retry_count` int default 0, `last_error` nullable, `timestamps`.
- **Related specs:** `docs/04` §13
- **Dependencies:** T-M2-001
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_notifications_table.php`
- **Acceptance criteria:** Indexes on `(user_id, status)`, `(scheduled_at)`.
- **Required tests:** Migration test.
- **Status:** Not Started

### T-M9-002 — Create notification_templates migration
- **Milestone:** M9
- **Title:** Create notification_templates migration
- **Description:** Table `notification_templates`: `id` UUID, `code` (unique), `name`, `channel` enum, `subject`, `body` text, `variables` JSON, `locale` string default `en`, `version` int, `active` bool, `timestamps`.
- **Related specs:** `docs/04` §13
- **Dependencies:** T-M9-001
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_notification_templates_table.php`
- **Acceptance criteria:** Migration roundtrips.
- **Required tests:** Migration test.
- **Status:** Not Started

### T-M9-003 — Create notification_logs migration
- **Milestone:** M9
- **Title:** Create notification_logs migration
- **Description:** Append-only table `notification_logs`: `id`, `notification_id` UUID FK, `channel`, `status`, `provider_response` JSON, `latency_ms` int, `attempted_at` timestamp.
- **Related specs:** `docs/04` §13
- **Dependencies:** T-M9-002
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_notification_logs_table.php`
- **Acceptance criteria:** No update/delete allowed by model.
- **Required tests:** Migration + model test.
- **Status:** Not Started

### T-M9-004 — Notification models
- **Milestone:** M9
- **Title:** Notification models
- **Description:** `Notification`, `NotificationTemplate`, `NotificationLog` models; templates use `casts`; `NotificationLog` is immutable.
- **Related specs:** `docs/04` §13
- **Dependencies:** T-M9-003
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Notifications/Models/Notification.php`, `backend/app/Modules/Notifications/Models/NotificationTemplate.php`, `backend/app/Modules/Notifications/Models/NotificationLog.php`
- **Acceptance criteria:** Relationships work; immutability test for `NotificationLog` passes.
- **Required tests:** `tests/Unit/Notifications/NotificationModelTest.php`.
- **Status:** Not Started

### T-M9-005 — ChannelInterface
- **Milestone:** M9
- **Title:** ChannelInterface
- **Description:** `ChannelInterface` with `send(Notification, NotificationTemplate): ChannelResult`; `ChannelResult` is a value object (success/error, latency, provider_response).
- **Related specs:** `docs/03` §17
- **Dependencies:** T-M9-004
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Notifications/Contracts/ChannelInterface.php`, `backend/app/Modules/Notifications/ValueObjects/ChannelResult.php`
- **Acceptance criteria:** Interface enforced by Pest test.
- **Required tests:** `tests/Unit/Notifications/ChannelInterfaceTest.php`.
- **Status:** Not Started

### T-M9-006 — LogChannel
- **Milestone:** M9
- **Title:** LogChannel
- **Description:** `LogChannel` writes notification to the `notifications.log` channel; dev-only default.
- **Related specs:** `docs/03` §17
- **Dependencies:** T-M9-005
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Notifications/Channels/LogChannel.php`
- **Acceptance criteria:** `send` returns `ChannelResult(success: true, latency: <50ms)`.
- **Required tests:** `tests/Feature/Notifications/LogChannelTest.php`.
- **Status:** Not Started

### T-M9-007 — MailChannel
- **Milestone:** M9
- **Title:** MailChannel
- **Description:** `MailChannel` uses Laravel `Mail` with a `Mailable` per template; sends via configured SMTP.
- **Related specs:** `docs/03` §17
- **Dependencies:** T-M9-005
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Notifications/Channels/MailChannel.php`, `backend/app/Modules/Notifications/Mail/TemplateMailable.php`
- **Acceptance criteria:** `Mail::fake()` asserts the mailable.
- **Required tests:** `tests/Feature/Notifications/MailChannelTest.php`.
- **Status:** Not Started

### T-M9-008 — PushChannel (FCM stub)
- **Milestone:** M9
- **Title:** PushChannel (FCM stub)
- **Description:** `PushChannel` calls an FCM HTTP v1 stub; returns success on 200; configurable via `ai_provider_configs`-like `notification_configs`.
- **Related specs:** `docs/03` §17
- **Dependencies:** T-M9-005
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Notifications/Channels/PushChannel.php`
- **Acceptance criteria:** With `Http::fake`, success and 5xx are handled.
- **Required tests:** `tests/Feature/Notifications/PushChannelTest.php`.
- **Status:** Not Started

### T-M9-009 — SmsChannel (provider stub)
- **Milestone:** M9
- **Title:** SmsChannel (provider stub)
- **Description:** `SmsChannel` reuses the `SmsGatewayInterface` registered in M2; falls back to `LogSmsGateway`.
- **Related specs:** `docs/03` §17
- **Dependencies:** T-M2-012, T-M9-005
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Notifications/Channels/SmsChannel.php`
- **Acceptance criteria:** Stub logs message.
- **Required tests:** `tests/Feature/Notifications/SmsChannelTest.php`.
- **Status:** Not Started

### T-M9-010 — WebhookChannel
- **Milestone:** M9
- **Title:** WebhookChannel
- **Description:** `WebhookChannel` POSTs JSON to a configured webhook URL with HMAC signature; uses `Http` client with timeout.
- **Related specs:** `docs/12` §20
- **Dependencies:** T-M9-005
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Notifications/Channels/WebhookChannel.php`
- **Acceptance criteria:** `Http::fake` receives signed payload.
- **Required tests:** `tests/Feature/Notifications/WebhookChannelTest.php`.
- **Status:** Not Started

### T-M9-011 — TemplateEngine
- **Milestone:** M9
- **Title:** TemplateEngine
- **Description:** `TemplateEngine::render(template, variables, locale): array` resolves variables and locale fallback; supports rollback via version.
- **Related specs:** `docs/04` §13
- **Dependencies:** T-M9-004
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Notifications/Services/TemplateEngine.php`
- **Acceptance criteria:** Missing variable throws; locale fallback to `en` works.
- **Required tests:** `tests/Unit/Notifications/TemplateEngineTest.php`.
- **Status:** Not Started

### T-M9-012 — NotificationDispatcher
- **Milestone:** M9
- **Title:** NotificationDispatcher
- **Description:** `NotificationDispatcher::dispatch(user, code, variables)` looks up active template, queues a `SendNotificationJob`; on retry exhaustion, marks `dead`.
- **Related specs:** `docs/03` §17
- **Dependencies:** T-M9-011, T-M9-006, T-M9-007, T-M9-008, T-M9-009, T-M9-010
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Notifications/Services/NotificationDispatcher.php`
- **Acceptance criteria:** Dead letter after 5 failures.
- **Required tests:** `tests/Feature/Notifications/NotificationDispatcherTest.php`.
- **Status:** Not Started

### T-M9-013 — SendNotificationJob
- **Milestone:** M9
- **Title:** SendNotificationJob
- **Description:** Queue job that picks the right channel, calls `send`, persists `NotificationLog`, retries with exponential backoff (1/5/15/60 min, max 5).
- **Related specs:** `docs/14` §16
- **Dependencies:** T-M9-012
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Notifications/Jobs/SendNotificationJob.php`
- **Acceptance criteria:** Backoff schedule verified by `Queue::fake`.
- **Required tests:** `tests/Feature/Notifications/SendNotificationJobTest.php`.
- **Status:** Not Started

### T-M9-014 — Wire event listeners
- **Milestone:** M9
- **Title:** Wire event listeners
- **Description:** `ReportSubmittedListener`, `ReportAssignedListener`, `ReportStatusChangedListener`, `AICompletedListener`, `SecurityEventListener` (placeholder) call `NotificationDispatcher::dispatch` with the right template code.
- **Related specs:** `docs/03` §16
- **Dependencies:** T-M9-013
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Notifications/Listeners/*`
- **Acceptance criteria:** Each event triggers the right template.
- **Required tests:** `tests/Feature/Notifications/EventListenersTest.php`.
- **Status:** Not Started

### T-M9-015 — GET /api/v1/notifications
- **Milestone:** M9
- **Title:** GET /api/v1/notifications
- **Description:** `NotificationsController@index` paginates the user's notifications with filters `unread`, `type`.
- **Related specs:** `docs/05` §12
- **Dependencies:** T-M9-001
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Notifications/Http/Controllers/Api/NotificationsController.php`, `backend/app/Modules/Notifications/Http/Resources/NotificationResource.php`
- **Acceptance criteria:** Only the user's notifications are returned.
- **Required tests:** `tests/Feature/Notifications/IndexEndpointTest.php`.
- **Status:** Not Started

### T-M9-016 — POST /api/v1/notifications/{id}/read
- **Milestone:** M9
- **Title:** POST /api/v1/notifications/{id}/read
- **Description:** Marks `read_at`; 403 if not owner; 404 if missing.
- **Related specs:** `docs/05` §12
- **Dependencies:** T-M9-015
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Notifications/Http/Controllers/Api/NotificationsController.php`
- **Acceptance criteria:** 200 on success; 403/404 otherwise.
- **Required tests:** `tests/Feature/Notifications/MarkReadEndpointTest.php`.
- **Status:** Not Started

### T-M9-017 — NotificationPreference endpoints
- **Milestone:** M9
- **Title:** NotificationPreference endpoints
- **Description:** `GET/PUT /api/v1/notifications/preferences` per channel + event code; backed by `settings` or a new `notification_preferences` table.
- **Related specs:** `docs/02` §14
- **Dependencies:** T-M9-016
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Notifications/Http/Controllers/Api/NotificationPreferenceController.php`, `backend/app/Modules/Notifications/Services/NotificationPreferenceService.php`
- **Acceptance criteria:** Disabled preference suppresses dispatch.
- **Required tests:** `tests/Feature/Notifications/PreferenceTest.php`.
- **Status:** Not Started

### T-M9-018 — Seed default notification templates
- **Milestone:** M9
- **Title:** Seed default notification templates
- **Description:** `NotificationTemplatesSeeder` inserts templates for `report_submitted`, `report_assigned`, `report_status_changed`, `ai_completed`, `security_event` per channel.
- **Related specs:** `docs/04` §13
- **Dependencies:** T-M9-011
- **Est. time:** 20 minutes
- **Files:** `backend/database/seeders/NotificationTemplatesSeeder.php`
- **Acceptance criteria:** ≥ 5 templates present.
- **Required tests:** Seed test.
- **Status:** Not Started

### T-M9-019 — NotificationFeatureTest
- **Milestone:** M9
- **Title:** NotificationFeatureTest
- **Description:** Pest feature covering dispatch, retry, dead letter, preference suppression, audit emission.
- **Related specs:** `docs/15` §7
- **Dependencies:** T-M9-018
- **Est. time:** 25 minutes
- **Files:** `backend/tests/Feature/Notifications/NotificationFeatureTest.php`
- **Acceptance criteria:** All cases green.
- **Required tests:** `vendor/bin/pest tests/Feature/Notifications/NotificationFeatureTest.php`.
- **Status:** Not Started

### T-M9-020 — Update OpenAPI and docs/notifications.md
- **Milestone:** M9
- **Title:** Update OpenAPI and docs/notifications.md
- **Description:** Add notification endpoints to `openapi.yaml`; author `docs/notifications.md` covering channels, retries, dead letter, and template authoring.
- **Related specs:** `docs/05` §23; `docs/14` §37
- **Dependencies:** T-M9-017
- **Est. time:** 20 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`, `docs/notifications.md`
- **Acceptance criteria:** `swagger-cli validate` passes; doc has a template example.
- **Required tests:** `tests/Feature/OpenApiNotificationsTest.php`.
- **Status:** Not Started


---

## Milestone M10 — Moderator Portal

**Source:** `.codex/roadmap.md` §M10. **Specs:** `docs/03` §4; `docs/05` §8; `docs/07` (entire); `docs/13` (entire); `docs/15` §7, §9.

---

### T-M10-001 — Create Moderation module skeleton
- **Milestone:** M10
- **Title:** Create Moderation module skeleton
- **Description:** Create `backend/app/Modules/Moderation/{Http,Services,Policies,Requests,Resources,Events,Listeners}/` and a `ModerationServiceProvider`.
- **Related specs:** `docs/03` §6
- **Dependencies:** T-M2-001
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Moderation/`
- **Acceptance criteria:** Provider registered in `config/app.php`; folders exist.
- **Required tests:** `php artisan route:list` includes the provider's routes after routing is added.
- **Status:** Not Started

### T-M10-002 — Moderation policy
- **Milestone:** M10
- **Title:** Moderation policy
- **Description:** `ModerationPolicy` with `viewQueue`, `review`, `merge`, `reject`, `escalate`; gates via `moderator` role.
- **Related specs:** `docs/07` §3
- **Dependencies:** T-M2-019
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Moderation/Policies/ModerationPolicy.php`
- **Acceptance criteria:** Citizens blocked; moderators pass.
- **Required tests:** `tests/Feature/Moderation/ModerationPolicyTest.php`.
- **Status:** Not Started

### T-M10-003 — ReviewReportDto
- **Milestone:** M10
- **Title:** ReviewReportDto
- **Description:** `ReviewReportDto` (decision, category, department, remarks, override_ai); readonly.
- **Related specs:** `docs/14` §10
- **Dependencies:** T-M1-002
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Moderation/DTO/ReviewReportDto.php`
- **Acceptance criteria:** DTO is immutable; missing fields throw.
- **Required tests:** `tests/Unit/Moderation/ReviewReportDtoTest.php`.
- **Status:** Not Started

### T-M10-004 — ModerationService.review
- **Milestone:** M10
- **Title:** ModerationService.review
- **Description:** `ModerationService::review(Report, ReviewReportDto, Moderator): Report` validates decision, updates category/department, emits `ReportModerated` event, writes audit, transitions workflow.
- **Related specs:** `docs/07` §12
- **Dependencies:** T-M10-003, T-M6-009
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Moderation/Services/ModerationService.php`
- **Acceptance criteria:** Override writes audit row with before/after category.
- **Required tests:** `tests/Feature/Moderation/ReviewServiceTest.php`.
- **Status:** Not Started

### T-M10-005 — ModerationService.merge
- **Milestone:** M10
- **Title:** ModerationService.merge
- **Description:** `merge(primaryId, duplicateIds[], reason, moderator)` keeps `primary`; marks duplicates as `Merged`; writes audit; emits `ReportsMerged`.
- **Related specs:** `docs/07` §13
- **Dependencies:** T-M10-004
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Moderation/Services/ModerationService.php`
- **Acceptance criteria:** Duplicates cannot be read via citizen API.
- **Required tests:** `tests/Feature/Moderation/MergeServiceTest.php`.
- **Status:** Not Started

### T-M10-006 — ModerationService.reject
- **Milestone:** M10
- **Title:** ModerationService.reject
- **Description:** `reject(Report, reason, Moderator)` transitions to `Rejected`, writes audit, emits event.
- **Related specs:** `docs/05` §8
- **Dependencies:** T-M10-004
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Moderation/Services/ModerationService.php`
- **Acceptance criteria:** Rejection is terminal.
- **Required tests:** `tests/Feature/Moderation/RejectServiceTest.php`.
- **Status:** Not Started

### T-M10-007 — ModerationService.escalate
- **Milestone:** M10
- **Title:** ModerationService.escalate
- **Description:** `escalate(Report, level, reason, Moderator)` writes escalation record; transitions workflow if defined.
- **Related specs:** `docs/07` §17
- **Dependencies:** T-M10-004
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Moderation/Services/ModerationService.php`
- **Acceptance criteria:** Escalation row written; audit emitted.
- **Required tests:** `tests/Feature/Moderation/EscalateServiceTest.php`.
- **Status:** Not Started

### T-M10-008 — /api/v1/moderator/queue
- **Milestone:** M10
- **Title:** /api/v1/moderator/queue
- **Description:** Paginated list of reports in `AI Processing` or `Pending Moderator` with filters `category`, `ward`, `confidence`, `date`, `priority`.
- **Related specs:** `docs/05` §8
- **Dependencies:** T-M10-001
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Moderation/Http/Controllers/Api/QueueController.php`
- **Acceptance criteria:** Filters compose; pagination meta correct.
- **Required tests:** `tests/Feature/Moderation/QueueEndpointTest.php`.
- **Status:** Not Started

### T-M10-009 — /api/v1/moderator/duplicates
- **Milestone:** M10
- **Title:** /api/v1/moderator/duplicates
- **Description:** Returns candidate duplicates for review, sorted by `duplicate_score` desc.
- **Related specs:** `docs/05` §8
- **Dependencies:** T-M10-008
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Moderation/Http/Controllers/Api/DuplicateQueueController.php`
- **Acceptance criteria:** Returns candidate pairs with similarity, distance, time delta.
- **Required tests:** `tests/Feature/Moderation/DuplicateQueueEndpointTest.php`.
- **Status:** Not Started

### T-M10-010 — /api/v1/moderator/fraud
- **Milestone:** M10
- **Title:** /api/v1/moderator/fraud
- **Description:** Returns reports with `fraud_score` above threshold; includes reasons from `security_events`.
- **Related specs:** `docs/05` §8
- **Dependencies:** T-M10-008
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Moderation/Http/Controllers/Api/FraudQueueController.php`
- **Acceptance criteria:** Returns fraud-suspect reports with reasons.
- **Required tests:** `tests/Feature/Moderation/FraudQueueEndpointTest.php`.
- **Status:** Not Started

### T-M10-011 — POST /api/v1/moderator/{review,merge,reject,escalate}
- **Milestone:** M10
- **Title:** POST /api/v1/moderator/{review,merge,reject,escalate}
- **Description:** Four endpoints wired to `ModerationService`; each uses a Form Request and emits audit.
- **Related specs:** `docs/05` §8
- **Dependencies:** T-M10-007
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Moderation/Http/Controllers/Api/ModerationActionsController.php`, `backend/app/Modules/Moderation/Http/Requests/*`
- **Acceptance criteria:** All four actions return 200 with updated `ReportResource`; 422 on bad input.
- **Required tests:** `tests/Feature/Moderation/ActionsEndpointTest.php`.
- **Status:** Not Started

### T-M10-012 — Moderator web app shell
- **Milestone:** M10
- **Title:** Moderator web app shell
- **Description:** Scaffold `frontend/apps/moderator/` with Vite + React Router + TanStack Query + shared `packages/ui` (if present) and design tokens from `docs/13`.
- **Related specs:** `docs/07` §29; `docs/13`
- **Dependencies:** T-M1-008
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/moderator/`
- **Acceptance criteria:** `npm run dev` starts on a unique port; `AppLayout` renders sidebar and header per `docs/13`.
- **Required tests:** `npm run build` exits 0.
- **Status:** Not Started

### T-M10-013 — Design system primitives
- **Milestone:** M10
- **Title:** Design system primitives
- **Description:** `frontend/packages/ui/` with `Button`, `Card`, `Table`, `Badge`, `Toast`, `Dialog`, `StatusBadge`, `ConfidenceBadge`, `FraudBadge` per `docs/13` §34.
- **Related specs:** `docs/13` §34
- **Dependencies:** T-M1-009
- **Est. time:** 30 minutes
- **Files:** `frontend/packages/ui/src/*`
- **Acceptance criteria:** Storybook or `*.stories.tsx` exists; Vitest component tests pass.
- **Required tests:** `npm run test --workspace=@cip/ui`.
- **Status:** Not Started

### T-M10-014 — Moderator Dashboard page
- **Milestone:** M10
- **Title:** Moderator Dashboard page
- **Description:** Dashboard page renders widgets from `docs/07` §4 using ECharts.
- **Related specs:** `docs/07` §4
- **Dependencies:** T-M10-013
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/moderator/src/pages/Dashboard.tsx`
- **Acceptance criteria:** Widgets render; loading and empty states exist.
- **Required tests:** Vitest component test.
- **Status:** Not Started

### T-M10-015 — Review Queue page
- **Milestone:** M10
- **Title:** Review Queue page
- **Description:** Data table with filters, pagination, sortable columns, keyboard nav per `docs/07` §6.
- **Related specs:** `docs/07` §6
- **Dependencies:** T-M10-014
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/moderator/src/pages/ReviewQueue.tsx`
- **Acceptance criteria:** Filters compose; row click navigates to detail.
- **Required tests:** Vitest + Playwright.
- **Status:** Not Started

### T-M10-016 — Report Detail page
- **Milestone:** M10
- **Title:** Report Detail page
- **Description:** Renders general info, evidence viewer, AI panel, timeline, assignments, audit, security events.
- **Related specs:** `docs/07` §8–11
- **Dependencies:** T-M10-015
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/moderator/src/pages/ReportDetails.tsx`
- **Acceptance criteria:** All sections render with safe data.
- **Required tests:** Playwright e2e.
- **Status:** Not Started

### T-M10-017 — Evidence Viewer component
- **Milestone:** M10
- **Title:** Evidence Viewer component
- **Description:** Image carousel, video player, metadata panel, fullscreen, no download per `docs/07` §9.
- **Related specs:** `docs/07` §9
- **Dependencies:** T-M10-016
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/moderator/src/components/EvidenceViewer.tsx`
- **Acceptance criteria:** Keyboard nav works; download disabled.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M10-018 — AI Analysis panel
- **Milestone:** M10
- **Title:** AI Analysis panel
- **Description:** Renders predicted category, confidence, suggested department, objects, severity, quality, duplicate, fraud, summary, prompt version per `docs/07` §11.
- **Related specs:** `docs/07` §11
- **Dependencies:** T-M10-016
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/moderator/src/components/AIAnalysisPanel.tsx`
- **Acceptance criteria:** Reads `ai_results` endpoint; loading/empty states.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M10-019 — Assignment dialog
- **Milestone:** M10
- **Title:** Assignment dialog
- **Description:** Dialog for assigning department, officer, priority, SLA, instructions per `docs/07` §16.
- **Related specs:** `docs/07` §16
- **Dependencies:** T-M10-016
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/moderator/src/components/AssignmentDialog.tsx`
- **Acceptance criteria:** Submits to `POST /moderator/review` with assignment.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M10-020 — Duplicate and Fraud queue pages
- **Milestone:** M10
- **Title:** Duplicate and Fraud queue pages
- **Description:** Two pages with their respective UIs (candidate pairs, fraud reasons).
- **Related specs:** `docs/07` §13, §14
- **Dependencies:** T-M10-015
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/moderator/src/pages/{DuplicateQueue,FraudQueue}.tsx`
- **Acceptance criteria:** Actions wired to backend endpoints.
- **Required tests:** Vitest + Playwright.
- **Status:** Not Started

### T-M10-021 — Keyboard shortcuts
- **Milestone:** M10
- **Title:** Keyboard shortcuts
- **Description:** Implement A/R/M/E/N/P/F shortcuts per `docs/07` §31; show a help dialog.
- **Related specs:** `docs/07` §31
- **Dependencies:** T-M10-016
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/moderator/src/hooks/useShortcuts.ts`
- **Acceptance criteria:** A approves, R rejects, etc.; respects focused input.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M10-022 — Bulk operations UI
- **Milestone:** M10
- **Title:** Bulk operations UI
- **Description:** Bulk select up to 100 with confirm dialog and progress per `docs/07` §19.
- **Related specs:** `docs/07` §19
- **Dependencies:** T-M10-015
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/moderator/src/components/BulkActions.tsx`
- **Acceptance criteria:** Confirms before sending; shows progress; reports failures.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M10-023 — Moderator analytics page
- **Milestone:** M10
- **Title:** Moderator analytics page
- **Description:** ECharts dashboards per `docs/07` §20.
- **Related specs:** `docs/07` §20
- **Dependencies:** T-M10-014
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/moderator/src/pages/Analytics.tsx`
- **Acceptance criteria:** All widgets render.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M10-024 — AI performance dashboard
- **Milestone:** M10
- **Title:** AI performance dashboard
- **Description:** Page per `docs/07` §21 with model accuracy, override rate, latency, provider availability.
- **Related specs:** `docs/07` §21
- **Dependencies:** T-M10-023
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/moderator/src/pages/AiPerformance.tsx`
- **Acceptance criteria:** Real data on staging; empty state otherwise.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M10-025 — Playwright E2E: review happy path
- **Milestone:** M10
- **Title:** Playwright E2E: review happy path
- **Description:** E2E covering login → queue → report detail → assign.
- **Related specs:** `docs/15` §9
- **Dependencies:** T-M10-019
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/moderator/e2e/review-happy.spec.ts`
- **Acceptance criteria:** Test passes against `vite preview` build.
- **Required tests:** `npm run e2e -- review-happy`.
- **Status:** Not Started

### T-M10-026 — Playwright E2E: merge and reject
- **Milestone:** M10
- **Title:** Playwright E2E: merge and reject
- **Description:** Two E2E tests: merge duplicates, reject fraud.
- **Related specs:** `docs/15` §9
- **Dependencies:** T-M10-025
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/moderator/e2e/{merge,reject}.spec.ts`
- **Acceptance criteria:** Both tests green.
- **Required tests:** `npm run e2e`.
- **Status:** Not Started

### T-M10-027 — Moderator a11y audit
- **Milestone:** M10
- **Title:** Moderator a11y audit
- **Description:** Run `axe-core` in Playwright; document WCAG AA pass.
- **Related specs:** `docs/13` §31; `docs/07` §32
- **Dependencies:** T-M10-026
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/moderator/e2e/a11y.spec.ts`
- **Acceptance criteria:** Zero serious/critical violations.
- **Required tests:** `npm run e2e -- a11y`.
- **Status:** Not Started

### T-M10-028 — Author docs/moderator.md
- **Milestone:** M10
- **Title:** Author docs/moderator.md
- **Description:** User guide for moderators: queues, evidence, AI panel, shortcuts, bulk ops.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M10-027
- **Est. time:** 20 minutes
- **Files:** `docs/moderator.md`
- **Acceptance criteria:** Doc has screenshots placeholders and keyboard shortcut table.
- **Required tests:** Manual.
- **Status:** Not Started


---

## Milestone M11 — Operations Portal (Department)

**Source:** `.codex/roadmap.md` §M11. **Specs:** `docs/03` §4; `docs/05` §9; `docs/08` (entire); `docs/13`; `docs/15` §7, §9.

---

### T-M11-001 — DepartmentPolicy
- **Milestone:** M11
- **Title:** DepartmentPolicy
- **Description:** `DepartmentPolicy` with `viewDashboard`, `viewReports`, `accept`, `start`, `progress`, `resolve`, `close`, `addNote`; restricts to members of the department.
- **Related specs:** `docs/11` §9; `docs/08` §2
- **Dependencies:** T-M2-019
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Departments/Policies/DepartmentPolicy.php`
- **Acceptance criteria:** Non-member gets 403.
- **Required tests:** `tests/Feature/Departments/DepartmentPolicyTest.php`.
- **Status:** Not Started

### T-M11-002 — DepartmentReportRepository
- **Milestone:** M11
- **Title:** DepartmentReportRepository
- **Description:** `DepartmentReportRepository::assignedTo(departmentId, filters)` paginated, filterable, sortable.
- **Related specs:** `docs/08` §9; `docs/14` §9
- **Dependencies:** T-M4-015
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Departments/Repositories/DepartmentReportRepository.php`
- **Acceptance criteria:** Filters compose; pagination meta correct.
- **Required tests:** `tests/Feature/Departments/DepartmentReportRepositoryTest.php`.
- **Status:** Not Started

### T-M11-003 — DepartmentReportService
- **Milestone:** M11
- **Title:** DepartmentReportService
- **Description:** `accept`, `start`, `progress`, `resolve`, `close`, `addNote`; uses `WorkflowEngine` for transitions; writes audit and emits events.
- **Related specs:** `docs/05` §9
- **Dependencies:** T-M11-002, T-M6-009
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Departments/Services/DepartmentReportService.php`
- **Acceptance criteria:** Every action writes audit + status history.
- **Required tests:** `tests/Feature/Departments/DepartmentReportServiceTest.php`.
- **Status:** Not Started

### T-M11-004 — InternalNote model and migration
- **Milestone:** M11
- **Title:** InternalNote model and migration
- **Description:** Table `report_internal_notes`: `id`, `report_id` UUID FK, `department_id` UUID FK, `author_id` UUID FK, `body` text, `timestamps`.
- **Related specs:** `docs/04` §7
- **Dependencies:** T-M4-007
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_report_internal_notes_table.php`, `backend/app/Modules/Reports/Models/InternalNote.php`
- **Acceptance criteria:** Migration roundtrips.
- **Required tests:** Migration test.
- **Status:** Not Started

### T-M11-005 — AddNote endpoint
- **Milestone:** M11
- **Title:** AddNote endpoint
- **Description:** `POST /api/v1/department/report/{id}/note` adds an internal note; private to the department.
- **Related specs:** `docs/05` §9
- **Dependencies:** T-M11-004
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Departments/Http/Controllers/Api/DepartmentReportActionsController.php`
- **Acceptance criteria:** 201; 403 for non-member; 403 for other departments' reports.
- **Required tests:** `tests/Feature/Departments/AddNoteEndpointTest.php`.
- **Status:** Not Started

### T-M11-006 — Department action endpoints
- **Milestone:** M11
- **Title:** Department action endpoints
- **Description:** `POST /api/v1/department/report/{id}/{accept|start|progress|resolve|close}`; each uses a Form Request and dispatches a workflow event.
- **Related specs:** `docs/05` §9
- **Dependencies:** T-M11-003
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Departments/Http/Controllers/Api/DepartmentReportActionsController.php`, `backend/app/Modules/Departments/Http/Requests/*`
- **Acceptance criteria:** Workflow transitions; audit; 403 for non-members.
- **Required tests:** `tests/Feature/Departments/ActionsEndpointTest.php`.
- **Status:** Not Started

### T-M11-007 — GET /api/v1/department/dashboard
- **Milestone:** M11
- **Title:** GET /api/v1/department/dashboard
- **Description:** Aggregates open, due today, SLA breaches, by category; per-department scope.
- **Related specs:** `docs/05` §9; `docs/08` §4
- **Dependencies:** T-M11-002
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Departments/Http/Controllers/Api/DepartmentDashboardController.php`, `backend/app/Modules/Departments/Http/Resources/DashboardResource.php`
- **Acceptance criteria:** Department-scoped; not cached stale.
- **Required tests:** `tests/Feature/Departments/DashboardEndpointTest.php`.
- **Status:** Not Started

### T-M11-008 — GET /api/v1/department/reports
- **Milestone:** M11
- **Title:** GET /api/v1/department/reports
- **Description:** Paginated list of department reports with filters; returns `DepartmentReportResource`.
- **Related specs:** `docs/05` §9
- **Dependencies:** T-M11-002
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Departments/Http/Controllers/Api/DepartmentReportListController.php`
- **Acceptance criteria:** Filters compose; only assigned reports.
- **Required tests:** `tests/Feature/Departments/ListEndpointTest.php`.
- **Status:** Not Started

### T-M11-009 — Department admin endpoints
- **Milestone:** M11
- **Title:** Department admin endpoints
- **Description:** CRUD for officers, SLAs, working hours, holiday calendar under `/api/v1/admin/departments/{id}/...`.
- **Related specs:** `docs/08` §8
- **Dependencies:** T-M11-008
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Departments/Http/Controllers/Admin/DepartmentAdminController.php`
- **Acceptance criteria:** CRUD works; audit emitted.
- **Required tests:** `tests/Feature/Departments/AdminEndpointsTest.php`.
- **Status:** Not Started

### T-M11-010 — Exports (CSV/Excel/PDF)
- **Milestone:** M11
- **Title:** Exports (CSV/Excel/PDF)
- **Description:** `GET /api/v1/department/reports/export?format=csv|xlsx|pdf`; respects filters; uses `maatwebsite/excel` and `barryvdh/dompdf`.
- **Related specs:** `docs/08` §25
- **Dependencies:** T-M11-008
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Departments/Exports/DepartmentReportsExport.php`
- **Acceptance criteria:** 200 with correct MIME; respects filters.
- **Required tests:** `tests/Feature/Departments/ExportTest.php`.
- **Status:** Not Started

### T-M11-011 — Operations web app shell
- **Milestone:** M11
- **Title:** Operations web app shell
- **Description:** Scaffold `frontend/apps/operations/` with shared UI package; routing per `docs/08` §3.
- **Related specs:** `docs/08` §3, §29
- **Dependencies:** T-M10-012
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/operations/`
- **Acceptance criteria:** `npm run build` exits 0; sidebar with role-based items.
- **Required tests:** Build + Vitest.
- **Status:** Not Started

### T-M11-012 — Operations Dashboard page
- **Milestone:** M11
- **Title:** Operations Dashboard page
- **Description:** Implements `docs/08` §4 with ECharts widgets, loading and empty states.
- **Related specs:** `docs/08` §4
- **Dependencies:** T-M11-011
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/operations/src/pages/Dashboard.tsx`
- **Acceptance criteria:** All widgets render under 2s on staging.
- **Required tests:** Vitest + Playwright.
- **Status:** Not Started

### T-M11-013 — Assigned Reports list
- **Milestone:** M11
- **Title:** Assigned Reports list
- **Description:** Data table with filters, sorting, bulk select up to 500 per `docs/08` §24.
- **Related specs:** `docs/08` §9, §24
- **Dependencies:** T-M11-012
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/operations/src/pages/AssignedReports.tsx`
- **Acceptance criteria:** Bulk select respects max 500.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M11-014 — Report Detail (department)
- **Milestone:** M11
- **Title:** Report Detail (department)
- **Description:** Renders sections per `docs/08` §6; action buttons Accept/Reject/Assign/Transfer/Resolve/Close/Escalate; internal notes section.
- **Related specs:** `docs/08` §6
- **Dependencies:** T-M11-013
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/operations/src/pages/ReportDetails.tsx`
- **Acceptance criteria:** Actions dispatch to backend; internal notes private to department.
- **Required tests:** Playwright.
- **Status:** Not Started

### T-M11-015 — GIS Map view
- **Milestone:** M11
- **Title:** GIS Map view
- **Description:** Leaflet + OpenStreetMap with markers, heatmap, ward boundaries, clusters per `docs/08` §17.
- **Related specs:** `docs/08` §17
- **Dependencies:** T-M11-013
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/operations/src/pages/GisMap.tsx`
- **Acceptance criteria:** Heatmap and clusters render; filters apply.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M11-016 — Department admin screens
- **Milestone:** M11
- **Title:** Department admin screens
- **Description:** Officers, SLAs, working hours, holiday calendar CRUD screens.
- **Related specs:** `docs/08` §8
- **Dependencies:** T-M11-014
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/operations/src/pages/Admin/*`
- **Acceptance criteria:** Forms validated; saves call admin API.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M11-017 — Operations Analytics page
- **Milestone:** M11
- **Title:** Operations Analytics page
- **Description:** Implements `docs/08` §16 with ECharts.
- **Related specs:** `docs/08` §16
- **Dependencies:** T-M11-012
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/operations/src/pages/Analytics.tsx`
- **Acceptance criteria:** All charts render with real data on staging.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M11-018 — Live queue updates (polling)
- **Milestone:** M11
- **Title:** Live queue updates (polling)
- **Description:** TanStack Query polling every 30s on the dashboard; or WebSocket bridge in production.
- **Related specs:** `docs/08` §7
- **Dependencies:** T-M11-012
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/operations/src/hooks/useLiveQueue.ts`
- **Acceptance criteria:** Polling respects visibility API.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M11-019 — Audit log search UI
- **Milestone:** M11
- **Title:** Audit log search UI
- **Description:** Search and filter UI for `audit_logs` per `docs/08` §18.
- **Related specs:** `docs/08` §18
- **Dependencies:** T-M11-013
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/operations/src/pages/AuditLog.tsx`
- **Acceptance criteria:** Filters compose; CSV export.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M11-020 — Security dashboard
- **Milestone:** M11
- **Title:** Security dashboard
- **Description:** Implements `docs/08` §19.
- **Related specs:** `docs/08` §19
- **Dependencies:** T-M11-013
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/operations/src/pages/Security.tsx`
- **Acceptance criteria:** All widgets render.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M11-021 — Exports UI buttons
- **Milestone:** M11
- **Title:** Exports UI buttons
- **Description:** Toolbar buttons for CSV/Excel/PDF exports on list pages.
- **Related specs:** `docs/08` §25
- **Dependencies:** T-M11-013
- **Est. time:** 15 minutes
- **Files:** `frontend/apps/operations/src/components/ExportMenu.tsx`
- **Acceptance criteria:** Downloads trigger; correct filenames.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M11-022 — Playwright E2E: accept→close
- **Milestone:** M11
- **Title:** Playwright E2E: accept→close
- **Description:** E2E covering the full lifecycle in the operations UI.
- **Related specs:** `docs/15` §9
- **Dependencies:** T-M11-014
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/operations/e2e/accept-to-close.spec.ts`
- **Acceptance criteria:** Test passes against preview.
- **Required tests:** `npm run e2e`.
- **Status:** Not Started

### T-M11-023 — Operations a11y audit
- **Milestone:** M11
- **Title:** Operations a11y audit
- **Description:** `axe-core` Playwright audit; document WCAG AA pass.
- **Related specs:** `docs/13` §31
- **Dependencies:** T-M11-022
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/operations/e2e/a11y.spec.ts`
- **Acceptance criteria:** Zero serious/critical violations.
- **Required tests:** `npm run e2e -- a11y`.
- **Status:** Not Started

### T-M11-024 — DepartmentFeatureTest (department scope)
- **Milestone:** M11
- **Title:** DepartmentFeatureTest (department scope)
- **Description:** Pest feature verifying that a member of dept A cannot see dept B's reports or notes.
- **Related specs:** `docs/11` §9
- **Dependencies:** T-M11-006
- **Est. time:** 25 minutes
- **Files:** `backend/tests/Feature/Departments/DepartmentScopeTest.php`
- **Acceptance criteria:** 403 enforced.
- **Required tests:** `vendor/bin/pest tests/Feature/Departments/DepartmentScopeTest.php`.
- **Status:** Not Started

### T-M11-025 — Update OpenAPI for department endpoints
- **Milestone:** M11
- **Title:** Update OpenAPI for department endpoints
- **Description:** Add all `/department/*` and admin endpoints to `openapi.yaml`.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M11-010
- **Est. time:** 20 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `swagger-cli validate` passes.
- **Required tests:** `tests/Feature/OpenApiDepartmentTest.php`.
- **Status:** Not Started

### T-M11-026 — Author docs/operations.md
- **Milestone:** M11
- **Title:** Author docs/operations.md
- **Description:** User guide for department officers: dashboard, lifecycle, notes, exports, map.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M11-025
- **Est. time:** 20 minutes
- **Files:** `docs/operations.md`
- **Acceptance criteria:** Doc covers each role.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M11-027 — README update for operations
- **Milestone:** M11
- **Title:** README update for operations
- **Description:** Add "Operations" section linking to `docs/operations.md`.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M11-026
- **Est. time:** 10 minutes
- **Files:** `README.md`
- **Acceptance criteria:** Anchor link works.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M11-028 — Pin and test exporter packages
- **Milestone:** M11
- **Title:** Pin and test exporter packages
- **Description:** Add `maatwebsite/excel` and `barryvdh/dompdf` to `composer.json`; verify composer install and a basic export.
- **Related specs:** `docs/14` §31
- **Dependencies:** T-M11-010
- **Est. time:** 15 minutes
- **Files:** `backend/composer.json`
- **Acceptance criteria:** `composer install` succeeds in CI.
- **Required tests:** `composer install --no-interaction`.
- **Status:** Not Started


---

## Milestone M12 — Super Admin Portal & Platform Configuration

**Source:** `.codex/roadmap.md` §M12. **Specs:** `docs/03` §4; `docs/05` §10; `docs/09` (entire); `docs/13`; `docs/15` §7, §9.

---

### T-M12-001 — Admin API: users CRUD
- **Milestone:** M12
- **Title:** Admin API: users CRUD
- **Description:** `AdminUserController` list/create/update/delete with Form Requests and `UserResource`; gates to `super_admin`.
- **Related specs:** `docs/05` §10; `docs/09` §8
- **Dependencies:** T-M2-001
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Users/Http/Controllers/Admin/AdminUserController.php`, `backend/app/Modules/Users/Http/Requests/*`, `backend/app/Modules/Users/Http/Resources/Admin/UserResource.php`
- **Acceptance criteria:** 5 endpoints, all gated; audit emitted.
- **Required tests:** `tests/Feature/Users/AdminUserCrudTest.php`.
- **Status:** Not Started

### T-M12-002 — Admin API: roles and permissions CRUD
- **Milestone:** M12
- **Title:** Admin API: roles and permissions CRUD
- **Description:** `AdminRoleController` and `AdminPermissionController` exposing full CRUD; role-permission attach/detach.
- **Related specs:** `docs/09` §9
- **Dependencies:** T-M12-001
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Users/Http/Controllers/Admin/*`
- **Acceptance criteria:** Custom roles supported; permission matrix editable.
- **Required tests:** `tests/Feature/Users/AdminRoleCrudTest.php`.
- **Status:** Not Started

### T-M12-003 — Admin API: report types CRUD
- **Milestone:** M12
- **Title:** Admin API: report types CRUD
- **Description:** `AdminReportTypeController` full CRUD with validation_rules JSON, default_department, min/max photos, video required.
- **Related specs:** `docs/09` §10
- **Dependencies:** T-M4-002
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Reports/Http/Controllers/Admin/AdminReportTypeController.php`
- **Acceptance criteria:** Creating a new type shows in citizen list within cache TTL.
- **Required tests:** `tests/Feature/Reports/AdminReportTypeCrudTest.php`.
- **Status:** Not Started

### T-M12-004 — Admin API: workflow CRUD (definitions/states/transitions)
- **Milestone:** M12
- **Title:** Admin API: workflow CRUD (definitions/states/transitions)
- **Description:** CRUD for definitions, states, transitions; bulk update for transitions; reorder.
- **Related specs:** `docs/09` §11
- **Dependencies:** T-M6-013
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Workflow/Http/Controllers/Admin/*`
- **Acceptance criteria:** Updating a definition invalidates cache.
- **Required tests:** `tests/Feature/Workflow/AdminWorkflowCrudTest.php`.
- **Status:** Not Started

### T-M12-005 — Admin API: routing rules CRUD
- **Milestone:** M12
- **Title:** Admin API: routing rules CRUD
- **Description:** Reuse M7 CRUD; add reorder endpoint.
- **Related specs:** `docs/09` §12
- **Dependencies:** T-M7-009
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Routing/Http/Controllers/Admin/*`
- **Acceptance criteria:** Reorder persists; cache invalidated.
- **Required tests:** `tests/Feature/Routing/AdminReorderTest.php`.
- **Status:** Not Started

### T-M12-006 — Admin API: AI providers and prompts CRUD
- **Milestone:** M12
- **Title:** Admin API: AI providers and prompts CRUD
- **Description:** Reuse M8 admin endpoints; add `/prompts/{id}/rollback` already implemented.
- **Related specs:** `docs/09` §13, §14
- **Dependencies:** T-M8-025
- **Est. time:** 15 minutes
- **Files:** already present
- **Acceptance criteria:** Admin can swap providers at runtime.
- **Required tests:** Integration test in `tests/Feature/AI/AdminIntegrationTest.php`.
- **Status:** Not Started

### T-M12-007 — Admin API: integrations CRUD
- **Milestone:** M12
- **Title:** Admin API: integrations CRUD
- **Description:** `AdminIntegrationController` exposes list/create/update/delete and `/integrations/{id}/health`.
- **Related specs:** `docs/12` §34
- **Dependencies:** T-M14-009
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Integrations/Http/Controllers/Admin/AdminIntegrationController.php`
- **Acceptance criteria:** CRUD works; health check returns provider status.
- **Required tests:** `tests/Feature/Integrations/AdminIntegrationCrudTest.php`.
- **Status:** Not Started

### T-M12-008 — Admin API: storage configs CRUD
- **Milestone:** M12
- **Title:** Admin API: storage configs CRUD
- **Description:** Manage `media_local` vs `media_minio`, retention, encryption.
- **Related specs:** `docs/09` §17
- **Dependencies:** T-M12-007
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Media/Http/Controllers/Admin/AdminStorageController.php`
- **Acceptance criteria:** Changing disk is reflected on next upload.
- **Required tests:** `tests/Feature/Media/AdminStorageTest.php`.
- **Status:** Not Started

### T-M12-009 — Admin API: notification configs
- **Milestone:** M12
- **Title:** Admin API: notification configs
- **Description:** CRUD for channel credentials, retry policies, per-locale template defaults.
- **Related specs:** `docs/09` §16
- **Dependencies:** T-M9-018
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Notifications/Http/Controllers/Admin/AdminNotificationConfigController.php`
- **Acceptance criteria:** Secrets masked; CRUD works.
- **Required tests:** `tests/Feature/Notifications/AdminNotificationConfigTest.php`.
- **Status:** Not Started

### T-M12-010 — Admin API: security policies CRUD
- **Milestone:** M12
- **Title:** Admin API: security policies CRUD
- **Description:** Configure password policy, OTP expiry, rate limits, allowed countries, retention, feature flags.
- **Related specs:** `docs/11` §40; `docs/09` §19
- **Dependencies:** T-M15-005
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Security/Http/Controllers/Admin/AdminSecurityPolicyController.php`
- **Acceptance criteria:** Changes apply without redeploy.
- **Required tests:** `tests/Feature/Security/AdminSecurityPolicyTest.php`.
- **Status:** Not Started

### T-M12-011 — Admin API: feature flags CRUD
- **Milestone:** M12
- **Title:** Admin API: feature flags CRUD
- **Description:** Reuse M3 endpoints; expose `/admin/feature-flags/evaluate?key=&user_id=`.
- **Related specs:** `docs/09` §18
- **Dependencies:** T-M3-018
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Settings/Http/Controllers/Admin/FeatureFlagController.php`
- **Acceptance criteria:** Evaluate returns deterministic value.
- **Required tests:** `tests/Feature/Settings/FeatureFlagEvaluateTest.php`.
- **Status:** Not Started

### T-M12-012 — Admin API: scheduler endpoints
- **Milestone:** M12
- **Title:** Admin API: scheduler endpoints
- **Description:** `GET /admin/scheduler/jobs`, `POST /admin/scheduler/jobs/{id}/run-now`, `POST /admin/scheduler/jobs/{id}/pause|resume`.
- **Related specs:** `docs/09` §23
- **Dependencies:** T-M6-022
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Shared/Http/Controllers/Admin/SchedulerController.php`
- **Acceptance criteria:** Pause prevents next run; resume re-enables.
- **Required tests:** `tests/Feature/Shared/SchedulerAdminTest.php`.
- **Status:** Not Started

### T-M12-013 — Admin API: organizations CRUD
- **Milestone:** M12
- **Title:** Admin API: organizations CRUD
- **Description:** Multi-tenant scaffold; CRUD; storage quota; branding.
- **Related specs:** `docs/09` §6
- **Dependencies:** T-M3-001
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Departments/Models/Organization.php`, `backend/database/migrations/*_create_organizations_table.php`, `backend/app/Modules/Departments/Http/Controllers/Admin/AdminOrganizationController.php`
- **Acceptance criteria:** CRUD works; soft deletes only where allowed.
- **Required tests:** `tests/Feature/Departments/OrganizationCrudTest.php`.
- **Status:** Not Started

### T-M12-014 — Admin API: audit log search
- **Milestone:** M12
- **Title:** Admin API: audit log search
- **Description:** `GET /admin/audit-logs` with filters `user`, `entity`, `action`, `date`, `ip`; CSV export.
- **Related specs:** `docs/09` §20
- **Dependencies:** T-M2-020
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Security/Http/Controllers/Admin/AdminAuditLogController.php`
- **Acceptance criteria:** Filters compose; export works; logs immutable.
- **Required tests:** `tests/Feature/Security/AuditLogSearchTest.php`.
- **Status:** Not Started

### T-M12-015 — Admin API: platform health
- **Milestone:** M12
- **Title:** Admin API: platform health
- **Description:** Aggregate DB, Redis, queue, AI, storage, scheduler health; latency and error counts.
- **Related specs:** `docs/09` §22
- **Dependencies:** T-M12-012
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Shared/Http/Controllers/Admin/PlatformHealthController.php`
- **Acceptance criteria:** Returns per-component status with timestamps.
- **Required tests:** `tests/Feature/Shared/PlatformHealthTest.php`.
- **Status:** Not Started

### T-M12-016 — Super admin web app shell
- **Milestone:** M12
- **Title:** Super admin web app shell
- **Description:** Scaffold `frontend/apps/super-admin/` with shared UI package and role-based navigation per `docs/09` §4.
- **Related specs:** `docs/09` §4
- **Dependencies:** T-M11-011
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/super-admin/`
- **Acceptance criteria:** Sidebar with all top-level items; `npm run build` exits 0.
- **Required tests:** Build + Vitest.
- **Status:** Not Started

### T-M12-017 — Users/Roles/Permissions screens
- **Milestone:** M12
- **Title:** Users/Roles/Permissions screens
- **Description:** List, create, edit screens for users and roles; permission matrix editor.
- **Related specs:** `docs/09` §8, §9
- **Dependencies:** T-M12-016
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/super-admin/src/pages/{Users,Roles,Permissions}/*`
- **Acceptance criteria:** Forms validated; matrix saves atomically.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-018 — Report types screen
- **Milestone:** M12
- **Title:** Report types screen
- **Description:** CRUD UI with validation_rules builder.
- **Related specs:** `docs/09` §10
- **Dependencies:** T-M12-017
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/super-admin/src/pages/ReportTypes/*`
- **Acceptance criteria:** New types appear in citizen list after cache TTL.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-019 — Workflow builder screen
- **Milestone:** M12
- **Title:** Workflow builder screen
- **Description:** Table editor for definitions, states, transitions (visual editor deferred).
- **Related specs:** `docs/09` §11
- **Dependencies:** T-M12-018
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/super-admin/src/pages/Workflow/*`
- **Acceptance criteria:** Edits persist and invalidate cache.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-020 — Routing rules screen
- **Milestone:** M12
- **Title:** Routing rules screen
- **Description:** CRUD + reorder UI for routing rules.
- **Related specs:** `docs/09` §12
- **Dependencies:** T-M12-019
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/super-admin/src/pages/Routing/*`
- **Acceptance criteria:** Reorder persists.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-021 — AI providers + prompts screen
- **Milestone:** M12
- **Title:** AI providers + prompts screen
- **Description:** CRUD with versioning, rollback, prompt diff view.
- **Related specs:** `docs/09` §13, §14
- **Dependencies:** T-M12-020
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/super-admin/src/pages/AI/*`
- **Acceptance criteria:** Rollback restores prior version.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-022 — Integrations + storage + notifications screens
- **Milestone:** M12
- **Title:** Integrations + storage + notifications screens
- **Description:** CRUD screens for integrations, storage, notification configs.
- **Related specs:** `docs/09` §15–17
- **Dependencies:** T-M12-021
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/super-admin/src/pages/{Integrations,Storage,Notifications}/*`
- **Acceptance criteria:** Secrets are masked in UI.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-023 — Security policies + feature flags screen
- **Milestone:** M12
- **Title:** Security policies + feature flags screen
- **Description:** Configures password policy, OTP expiry, rate limits, feature flags, retention.
- **Related specs:** `docs/09` §18, §19
- **Dependencies:** T-M12-022
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/super-admin/src/pages/{Security,FeatureFlags}/*`
- **Acceptance criteria:** Changes apply without redeploy.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-024 — Audit log search UI
- **Milestone:** M12
- **Title:** Audit log search UI
- **Description:** Search, filter, export per `docs/09` §20.
- **Related specs:** `docs/09` §20
- **Dependencies:** T-M12-023
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/super-admin/src/pages/AuditLog.tsx`
- **Acceptance criteria:** Filters compose; export CSV works.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-025 — Platform health UI
- **Milestone:** M12
- **Title:** Platform health UI
- **Description:** Dashboard per `docs/09` §22.
- **Related specs:** `docs/09` §22
- **Dependencies:** T-M12-024
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/super-admin/src/pages/Health.tsx`
- **Acceptance criteria:** Each component shows status/latency/errors.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-026 — Scheduler dashboard UI
- **Milestone:** M12
- **Title:** Scheduler dashboard UI
- **Description:** Per `docs/09` §23 with pause/resume/run-now.
- **Related specs:** `docs/09` §23
- **Dependencies:** T-M12-025
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/super-admin/src/pages/Scheduler.tsx`
- **Acceptance criteria:** Actions dispatch to backend.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-027 — Data retention and backup screens
- **Milestone:** M12
- **Title:** Data retention and backup screens
- **Description:** Per `docs/09` §25, §26.
- **Related specs:** `docs/09` §25, §26
- **Dependencies:** T-M12-026
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/super-admin/src/pages/{Retention,Backups}/*`
- **Acceptance criteria:** Configs persist; restore drill visible.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-028 — System configuration screen
- **Milestone:** M12
- **Title:** System configuration screen
- **Description:** Per `docs/09` §29; branding, support email, version.
- **Related specs:** `docs/09` §29
- **Dependencies:** T-M12-027
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/super-admin/src/pages/SystemConfig.tsx`
- **Acceptance criteria:** Branding uploads validated.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M12-029 — Playwright E2E: configure report type → submit report
- **Milestone:** M12
- **Title:** Playwright E2E: configure report type → submit report
- **Description:** E2E covering create report type, workflow, routing rule, then submit a report that traverses the chain.
- **Related specs:** `docs/15` §9
- **Dependencies:** T-M12-028
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/super-admin/e2e/configure-and-submit.spec.ts`
- **Acceptance criteria:** E2E green.
- **Required tests:** `npm run e2e`.
- **Status:** Not Started

### T-M12-030 — Super admin a11y audit
- **Milestone:** M12
- **Title:** Super admin a11y audit
- **Description:** `axe-core` audit; document WCAG AA pass.
- **Related specs:** `docs/13` §31
- **Dependencies:** T-M12-029
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/super-admin/e2e/a11y.spec.ts`
- **Acceptance criteria:** Zero serious/critical violations.
- **Required tests:** `npm run e2e -- a11y`.
- **Status:** Not Started

### T-M12-031 — Update OpenAPI for super admin
- **Milestone:** M12
- **Title:** Update OpenAPI for super admin
- **Description:** Add all new admin endpoints to `openapi.yaml`.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M12-015
- **Est. time:** 25 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `swagger-cli validate` passes.
- **Required tests:** `tests/Feature/OpenApiSuperAdminTest.php`.
- **Status:** Not Started

### T-M12-032 — Author docs/admin.md
- **Milestone:** M12
- **Title:** Author docs/admin.md
- **Description:** User guide for super admin: each section with a "no code change required" example.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M12-031
- **Est. time:** 25 minutes
- **Files:** `docs/admin.md`
- **Acceptance criteria:** Doc covers every top-level nav item.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M12-033 — README update for super admin
- **Milestone:** M12
- **Title:** README update for super admin
- **Description:** Add "Admin" section linking to `docs/admin.md`.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M12-032
- **Est. time:** 10 minutes
- **Files:** `README.md`
- **Acceptance criteria:** Anchor link present.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M12-034 — AuditLogExportTest
- **Milestone:** M12
- **Title:** AuditLogExportTest
- **Description:** Pest feature covering CSV export of audit logs.
- **Related specs:** `docs/15` §7
- **Dependencies:** T-M12-014
- **Est. time:** 15 minutes
- **Files:** `backend/tests/Feature/Security/AuditLogExportTest.php`
- **Acceptance criteria:** CSV contains header and rows.
- **Required tests:** `vendor/bin/pest tests/Feature/Security/AuditLogExportTest.php`.
- **Status:** Not Started


---

## Milestone M13 — Citizen PWA

**Source:** `.codex/roadmap.md` §M13. **Specs:** `docs/03` §4; `docs/05` §6; `docs/06` (entire); `docs/11` §12, §13, §26; `docs/13`; `docs/15` §21, §22.

---

### T-M13-001 — Citizen PWA scaffold
- **Milestone:** M13
- **Title:** Citizen PWA scaffold
- **Description:** Scaffold `frontend/apps/citizen/` with Vite + React 19 + PWA plugin (`vite-plugin-pwa` + Workbox).
- **Related specs:** `docs/06` §2, §4
- **Dependencies:** T-M1-008
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/citizen/`
- **Acceptance criteria:** `npm run build` produces `manifest.webmanifest` and service worker.
- **Required tests:** Build + Vitest.
- **Status:** Not Started

### T-M13-002 — Design tokens and base components
- **Milestone:** M13
- **Title:** Design tokens and base components
- **Description:** Reuse shared `packages/ui`; add citizen-specific `AppLayout`, `Header`, `BottomNav`, `StatusBadge`, `Toast`.
- **Related specs:** `docs/13` §11, §34
- **Dependencies:** T-M13-001
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/citizen/src/components/layout/*`
- **Acceptance criteria:** All layouts render with token-based styles.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-003 — Routing skeleton
- **Milestone:** M13
- **Title:** Routing skeleton
- **Description:** React Router with routes `/`, `/login`, `/verify-otp`, `/dashboard`, `/reports`, `/reports/new`, `/reports/:id`, `/notifications`, `/profile`, `/settings` per `docs/06` §33.
- **Related specs:** `docs/06` §33
- **Dependencies:** T-M13-002
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/citizen/src/routes.tsx`
- **Acceptance criteria:** Each route renders its placeholder.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-004 — Auth: Login + OTP screens
- **Milestone:** M13
- **Title:** Auth: Login + OTP screens
- **Description:** Mobile + OTP screen with React Hook Form + Zod; calls `POST /auth/send-otp` and `/auth/verify-otp`.
- **Related specs:** `docs/06` §6
- **Dependencies:** T-M13-003
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/citizen/src/pages/auth/*`
- **Acceptance criteria:** Form validates; tokens stored in memory; refresh handled.
- **Required tests:** Vitest + Playwright.
- **Status:** Not Started

### T-M13-005 — Auth state + API client
- **Milestone:** M13
- **Title:** Auth state + API client
- **Description:** TanStack Query auth provider; axios/fetch client with token interceptor, refresh-on-401, 429 backoff.
- **Related specs:** `docs/06` §31
- **Dependencies:** T-M13-004
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/citizen/src/api/client.ts`
- **Acceptance criteria:** 401 triggers refresh; 429 waits.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-006 — IndexedDB offline queue
- **Milestone:** M13
- **Title:** IndexedDB offline queue
- **Description:** `offline/queue.ts` using `idb`; stores drafts, media blobs, pending submissions; exponential backoff retry.
- **Related specs:** `docs/06` §22, §23
- **Dependencies:** T-M13-005
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/citizen/src/offline/queue.ts`
- **Acceptance criteria:** Queue persists across reloads; retry respects backoff.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-007 — Workbox background sync
- **Milestone:** M13
- **Title:** Workbox background sync
- **Description:** Register a Workbox background sync queue for media uploads; rehydrate on reconnect.
- **Related specs:** `docs/06` §22
- **Dependencies:** T-M13-006
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/citizen/src/workers/sw.ts`
- **Acceptance criteria:** Service worker registers; offline upload retries.
- **Required tests:** Playwright with offline profile.
- **Status:** Not Started

### T-M13-008 — Camera capture component
- **Milestone:** M13
- **Title:** Camera capture component
- **Description:** `CameraCapture` uses `MediaDevices.getUserMedia`; only live capture; no file picker; capture photo + record video with metadata extraction.
- **Related specs:** `docs/06` §10, §11
- **Dependencies:** T-M13-006
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/citizen/src/components/CameraCapture.tsx`
- **Acceptance criteria:** Multi-photo; 3–5s video enforced client-side; gallery uploads blocked.
- **Required tests:** Vitest + Playwright with mocked camera.
- **Status:** Not Started

### T-M13-009 — GPS capture component
- **Milestone:** M13
- **Title:** GPS capture component
- **Description:** `GpsCapture` uses `navigator.geolocation`; displays accuracy; rejects above threshold; mock-GPS best-effort detection.
- **Related specs:** `docs/06` §13; `docs/11` §12
- **Dependencies:** T-M13-008
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/citizen/src/components/GpsCapture.tsx`
- **Acceptance criteria:** Accuracy < 50m required; mock-GPS reported.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-010 — Category selection page
- **Milestone:** M13
- **Title:** Category selection page
- **Description:** Lists `report_types` from API; searchable; never hardcoded.
- **Related specs:** `docs/06` §9
- **Dependencies:** T-M13-005
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/citizen/src/pages/reports/NewReport.tsx`
- **Acceptance criteria:** Categories loaded from API.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-011 — Report submission flow
- **Milestone:** M13
- **Title:** Report submission flow
- **Description:** Multi-step flow `Category → Capture → Location → Review → Submit`; per `docs/06` §8; uses offline queue when offline.
- **Related specs:** `docs/06` §8
- **Dependencies:** T-M13-010, T-M13-008, T-M13-009
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/citizen/src/pages/reports/NewReport.tsx`
- **Acceptance criteria:** Submission success returns tracking number; offline path queues.
- **Required tests:** Vitest + Playwright.
- **Status:** Not Started

### T-M13-012 — My Reports list
- **Milestone:** M13
- **Title:** My Reports list
- **Description:** Paginated list with filters, search, sort; no edit/delete.
- **Related specs:** `docs/06` §17
- **Dependencies:** T-M13-005
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/citizen/src/pages/reports/MyReports.tsx`
- **Acceptance criteria:** Filters and pagination work.
- **Required tests:** Vitest + Playwright.
- **Status:** Not Started

### T-M13-013 — Report Detail
- **Milestone:** M13
- **Title:** Report Detail
- **Description:** Renders timeline, evidence, status, AI classification; read-only.
- **Related specs:** `docs/06` §18
- **Dependencies:** T-M13-012
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/citizen/src/pages/reports/ReportDetails.tsx`
- **Acceptance criteria:** No edit/delete controls.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-014 — Dashboard page
- **Milestone:** M13
- **Title:** Dashboard page
- **Description:** Per `docs/06` §7: counts, recent notifications, action buttons.
- **Related specs:** `docs/06` §7
- **Dependencies:** T-M13-012
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/citizen/src/pages/Dashboard.tsx`
- **Acceptance criteria:** Counts match API.
- **Required tests:** Vitest + Playwright.
- **Status:** Not Started

### T-M13-015 — Notifications page
- **Milestone:** M13
- **Title:** Notifications page
- **Description:** List + mark-read; uses `/api/v1/notifications`.
- **Related specs:** `docs/05` §12; `docs/06` §19
- **Dependencies:** T-M13-005
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/citizen/src/pages/Notifications.tsx`
- **Acceptance criteria:** Mark read works.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-016 — Profile and Settings pages
- **Milestone:** M13
- **Title:** Profile and Settings pages
- **Description:** Read-only profile; settings: notifications, theme, privacy, terms.
- **Related specs:** `docs/06` §20, §21
- **Dependencies:** T-M13-005
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/citizen/src/pages/{Profile,Settings}.tsx`
- **Acceptance criteria:** Pages render.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-017 — Web Push subscription
- **Milestone:** M13
- **Title:** Web Push subscription
- **Description:** Subscribe to push; send subscription to backend; unsubscribe on logout.
- **Related specs:** `docs/06` §24
- **Dependencies:** T-M13-005
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/citizen/src/push/subscribe.ts`
- **Acceptance criteria:** Subscription persisted server-side; logout unsubscribes.
- **Required tests:** Vitest + Playwright.
- **Status:** Not Started

### T-M13-018 — Mock-GPS detection (best effort)
- **Milestone:** M13
- **Title:** Mock-GPS detection (best effort)
- **Description:** `mockGpsLikely()` checks `position.coords.accuracy`, `altitude` plausibility, `mock` flag (where supported); reports to API as `security_event`.
- **Related specs:** `docs/11` §12
- **Dependencies:** T-M13-009
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/citizen/src/security/mockGps.ts`
- **Acceptance criteria:** Detection runs and reports; never false-positives normal usage.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-019 — Camera security guardrails
- **Milestone:** M13
- **Title:** Camera security guardrails
- **Description:** Block file inputs, disable right-click save on evidence previews, strip EXIF before display.
- **Related specs:** `docs/06` §26; `docs/11` §13
- **Dependencies:** T-M13-008
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/citizen/src/security/evidenceGuards.ts`
- **Acceptance criteria:** File inputs absent; right-click blocked; EXIF stripped in previews.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-020 — Error and empty states
- **Milestone:** M13
- **Title:** Error and empty states
- **Description:** Reusable `EmptyState`, `ErrorState`, `LoadingSkeleton` for every list and detail page.
- **Related specs:** `docs/13` §27, §28
- **Dependencies:** T-M13-012
- **Est. time:** 20 minutes
- **Files:** `frontend/packages/ui/src/feedback/*`
- **Acceptance criteria:** All pages have the three states.
- **Required tests:** Vitest.
- **Status:** Not Started

### T-M13-021 — Accessibility audit
- **Milestone:** M13
- **Title:** Accessibility audit
- **Description:** `axe-core` Playwright audit; keyboard nav; touch target 44px.
- **Related specs:** `docs/06` §27; `docs/13` §31
- **Dependencies:** T-M13-020
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/citizen/e2e/a11y.spec.ts`
- **Acceptance criteria:** Zero serious/critical violations; Lighthouse a11y ≥ 95.
- **Required tests:** `npm run e2e -- a11y`.
- **Status:** Not Started

### T-M13-022 — Performance / Lighthouse
- **Milestone:** M13
- **Title:** Performance / Lighthouse
- **Description:** Lighthouse CI on PRs; targets: Performance ≥ 90, A11y ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
- **Related specs:** `docs/06` §29
- **Dependencies:** T-M13-021
- **Est. time:** 25 minutes
- **Files:** `.github/workflows/lighthouse.yml`, `lighthouserc.json`
- **Acceptance criteria:** Score targets met on preview.
- **Required tests:** `lhci autorun`.
- **Status:** Not Started

### T-M13-023 — Playwright E2E: full submission
- **Milestone:** M13
- **Title:** Playwright E2E: full submission
- **Description:** Mocked camera + GPS; submit; verify tracking number on dashboard.
- **Related specs:** `docs/15` §9
- **Dependencies:** T-M13-022
- **Est. time:** 30 minutes
- **Files:** `frontend/apps/citizen/e2e/submit.spec.ts`
- **Acceptance criteria:** E2E green.
- **Required tests:** `npm run e2e -- submit`.
- **Status:** Not Started

### T-M13-024 — Playwright E2E: offline path
- **Milestone:** M13
- **Title:** Playwright E2E: offline path
- **Description:** Submit while offline, then go online and verify sync.
- **Related specs:** `docs/15` §9
- **Dependencies:** T-M13-023
- **Est. time:** 25 minutes
- **Files:** `frontend/apps/citizen/e2e/offline.spec.ts`
- **Acceptance criteria:** E2E green.
- **Required tests:** `npm run e2e -- offline`.
- **Status:** Not Started

### T-M13-025 — Playwright E2E: push notification
- **Milestone:** M13
- **Title:** Playwright E2E: push notification
- **Description:** Server-driven push reaches the SW and shows a toast.
- **Related specs:** `docs/15` §9
- **Dependencies:** T-M13-024
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/citizen/e2e/push.spec.ts`
- **Acceptance criteria:** E2E green.
- **Required tests:** `npm run e2e -- push`.
- **Status:** Not Started

### T-M13-026 — Vitest unit: offline queue
- **Milestone:** M13
- **Title:** Vitest unit: offline queue
- **Description:** Unit tests for `offline/queue.ts` enqueue, retry, dedupe.
- **Related specs:** `docs/15` §21
- **Dependencies:** T-M13-006
- **Est. time:** 20 minutes
- **Files:** `frontend/apps/citizen/src/offline/queue.test.ts`
- **Acceptance criteria:** All cases pass.
- **Required tests:** `npm run test -- offline`.
- **Status:** Not Started

### T-M13-027 — Vitest unit: video duration guard
- **Milestone:** M13
- **Title:** Vitest unit: video duration guard
- **Description:** Unit tests verifying 3–5s enforcement.
- **Related specs:** `docs/06` §12
- **Dependencies:** T-M13-008
- **Est. time:** 15 minutes
- **Files:** `frontend/apps/citizen/src/components/CameraCapture.test.tsx`
- **Acceptance criteria:** 2s and 6s rejected.
- **Required tests:** `npm run test -- camera`.
- **Status:** Not Started

### T-M13-028 — Author docs/citizen.md
- **Milestone:** M13
- **Title:** Author docs/citizen.md
- **Description:** User guide for citizens: install, login, capture, submit, track, offline.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M13-025
- **Est. time:** 20 minutes
- **Files:** `docs/citizen.md`
- **Acceptance criteria:** Doc covers happy path + offline path.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M13-029 — README update for citizen
- **Milestone:** M13
- **Title:** README update for citizen
- **Description:** Add "Citizen PWA" section with quickstart and install steps.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M13-028
- **Est. time:** 10 minutes
- **Files:** `README.md`
- **Acceptance criteria:** Section present.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M13-030 — Citizen security review checklist
- **Milestone:** M13
- **Title:** Citizen security review checklist
- **Description:** Run through `docs/11` §11 (browser integrity) and document the browser-side controls present in the PWA.
- **Related specs:** `docs/11` §11, §26
- **Dependencies:** T-M13-029
- **Est. time:** 15 minutes
- **Files:** `docs/citizen-security.md`
- **Acceptance criteria:** Checklist signed off.
- **Required tests:** Manual.
- **Status:** Not Started


---

## Milestone M14 — External Connector Framework

**Source:** `.codex/roadmap.md` §M14. **Specs:** `docs/03` §8; `docs/04` §14; `docs/12` (entire).

---

### T-M14-001 — Create integration_connectors migration
- **Milestone:** M14
- **Title:** Create integration_connectors migration
- **Description:** Table `integration_connectors`: `id` UUID, `name`, `code` (unique), `type` enum(`REST`,`SOAP`,`WEBHOOK`,`MOCK`), `auth_type`, `auth_config` JSON, `base_url`, `sandbox_url`, `headers` JSON, `timeout_ms`, `retry_count`, `retry_delays` JSON, `priority` int, `enabled` bool, `version`, `field_mappings` JSON, `description`, `timestamps`, `deleted_at`.
- **Related specs:** `docs/04` §14; `docs/12` §9
- **Dependencies:** T-M1-002
- **Est. time:** 25 minutes
- **Files:** `backend/database/migrations/*_create_integration_connectors_table.php`
- **Acceptance criteria:** Migration roundtrips.
- **Required tests:** Migration test.
- **Status:** Not Started

### T-M14-002 — Create integration_requests migration
- **Milestone:** M14
- **Title:** Create integration_requests migration
- **Description:** Table `integration_requests`: `id` UUID, `connector_id` UUID FK, `operation`, `idempotency_key`, `correlation_id`, `request_payload` JSON, `response_payload` JSON, `status` enum, `http_status` int nullable, `latency_ms` int nullable, `retry_count` int default 0, `attempted_at` timestamp, `completed_at` nullable.
- **Related specs:** `docs/04` §14
- **Dependencies:** T-M14-001
- **Est. time:** 20 minutes
- **Files:** `backend/database/migrations/*_create_integration_requests_table.php`
- **Acceptance criteria:** Indexes on `(connector_id, status)`.
- **Required tests:** Migration test.
- **Status:** Not Started

### T-M14-003 — Create integration_dead_letters migration
- **Milestone:** M14
- **Title:** Create integration_dead_letters migration
- **Description:** Table `integration_dead_letters`: `id`, `request_id` UUID FK, `connector_id` UUID FK, `last_error`, `payload_snapshot` JSON, `status` enum(`pending`,`retrying`,`canceled`,`completed`), `created_at`, `updated_at`.
- **Related specs:** `docs/12` §17
- **Dependencies:** T-M14-002
- **Est. time:** 15 minutes
- **Files:** `backend/database/migrations/*_create_integration_dead_letters_table.php`
- **Acceptance criteria:** Migration roundtrips.
- **Required tests:** Migration test.
- **Status:** Not Started

### T-M14-004 — Connector Eloquent models
- **Milestone:** M14
- **Title:** Connector Eloquent models
- **Description:** `IntegrationConnector`, `IntegrationRequest`, `IntegrationDeadLetter` with relationships and casts.
- **Related specs:** `docs/04` §14
- **Dependencies:** T-M14-003
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Integrations/Models/*`
- **Acceptance criteria:** Relationships work.
- **Required tests:** Model test.
- **Status:** Not Started

### T-M14-005 — ConnectorInterface
- **Milestone:** M14
- **Title:** ConnectorInterface
- **Description:** `ConnectorInterface` with `connect`, `authenticate`, `validate`, `buildPayload`, `send`, `receive`, `normalize`, `healthCheck`, `disconnect` per `docs/12` §8.
- **Related specs:** `docs/12` §8
- **Dependencies:** T-M14-004
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Integrations/Contracts/ConnectorInterface.php`
- **Acceptance criteria:** Interface enforced by Pest.
- **Required tests:** `tests/Unit/Integrations/ConnectorInterfaceTest.php`.
- **Status:** Not Started

### T-M14-006 — Authentication strategies
- **Milestone:** M14
- **Title:** Authentication strategies
- **Description:** Strategy classes `NoneAuth`, `ApiKeyAuth`, `BearerAuth`, `OAuth2ClientCredentialsAuth`, `BasicAuth`, `CustomHeaderAuth`; resolve via config.
- **Related specs:** `docs/12` §10
- **Dependencies:** T-M14-005
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Integrations/Auth/*`
- **Acceptance criteria:** Each strategy unit-tested.
- **Required tests:** `tests/Unit/Integrations/AuthStrategiesTest.php`.
- **Status:** Not Started

### T-M14-007 — RestConnector
- **Milestone:** M14
- **Title:** RestConnector
- **Description:** `RestConnector` implements `ConnectorInterface` using Laravel `Http` client; handles timeouts, retries, response normalization.
- **Related specs:** `docs/12` §5
- **Dependencies:** T-M14-006
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Integrations/Connectors/RestConnector.php`
- **Acceptance criteria:** 200 + 5xx flows tested.
- **Required tests:** `tests/Feature/Integrations/RestConnectorTest.php`.
- **Status:** Not Started

### T-M14-008 — SoapConnector and WebhookConnector
- **Milestone:** M14
- **Title:** SoapConnector and WebhookConnector
- **Description:** `SoapConnector` and `WebhookConnector` implementing `ConnectorInterface`; SOAP uses `soap` extension if available, otherwise stub.
- **Related specs:** `docs/12` §5
- **Dependencies:** T-M14-007
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Integrations/Connectors/{Soap,Webhook}Connector.php`
- **Acceptance criteria:** Both have feature tests.
- **Required tests:** `tests/Feature/Integrations/{Soap,Webhook}ConnectorTest.php`.
- **Status:** Not Started

### T-M14-009 — FieldMappingEngine
- **Milestone:** M14
- **Title:** FieldMappingEngine
- **Description:** `FieldMappingEngine::apply(array $mappings, array $input): array` supports `rename`, `concat`, `split`, `static`, `conditional`, `date_format`, `bool`.
- **Related specs:** `docs/12` §13
- **Dependencies:** T-M14-005
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Integrations/Mapping/FieldMappingEngine.php`
- **Acceptance criteria:** Each transform unit-tested.
- **Required tests:** `tests/Unit/Integrations/FieldMappingEngineTest.php`.
- **Status:** Not Started

### T-M14-010 — RetryStrategy
- **Milestone:** M14
- **Title:** RetryStrategy
- **Description:** `RetryStrategy` with delays 1/5/15/60 min, max 5 attempts; honors retryable conditions (timeout, 503, 504, 429) and non-retryable (400, 401, 403, 404, 422).
- **Related specs:** `docs/12` §16
- **Dependencies:** T-M14-007
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Integrations/Resilience/RetryStrategy.php`
- **Acceptance criteria:** 4xx not retried; 5xx retried with correct delays.
- **Required tests:** `tests/Unit/Integrations/RetryStrategyTest.php`.
- **Status:** Not Started

### T-M14-011 — DeadLetterService
- **Milestone:** M14
- **Title:** DeadLetterService
- **Description:** `DeadLetterService::move(IntegrationRequest, $error)` writes to DLQ; `retry(DlqId)` re-queues.
- **Related specs:** `docs/12` §17
- **Dependencies:** T-M14-010
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Integrations/Resilience/DeadLetterService.php`
- **Acceptance criteria:** Retry on DLQ entry produces new request.
- **Required tests:** `tests/Feature/Integrations/DeadLetterTest.php`.
- **Status:** Not Started

### T-M14-012 — ConnectorManager
- **Milestone:** M14
- **Title:** ConnectorManager
- **Description:** `ConnectorManager::execute(connectorCode, operation, payload, $actor): IntegrationRequest` resolves connector, builds payload, dispatches `RunConnectorJob`, persists request row.
- **Related specs:** `docs/12` §7
- **Dependencies:** T-M14-011, T-M14-009
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Integrations/Services/ConnectorManager.php`
- **Acceptance criteria:** End-to-end: payload → RestConnector → IntegrationRequest.
- **Required tests:** `tests/Feature/Integrations/ConnectorManagerTest.php`.
- **Status:** Not Started

### T-M14-013 — RunConnectorJob
- **Milestone:** M14
- **Title:** RunConnectorJob
- **Description:** Queue job executing the connector; on success, persists response and emits `ConnectorSucceeded`; on failure, applies `RetryStrategy` or moves to DLQ.
- **Related specs:** `docs/14` §16; `docs/12` §33
- **Dependencies:** T-M14-012
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Integrations/Jobs/RunConnectorJob.php`
- **Acceptance criteria:** Job retries and DLQs as configured.
- **Required tests:** `tests/Feature/Integrations/RunConnectorJobTest.php`.
- **Status:** Not Started

### T-M14-014 — ConnectorEvents
- **Milestone:** M14
- **Title:** ConnectorEvents
- **Description:** `ConnectorRequested`, `ConnectorSucceeded`, `ConnectorFailed`, `ConnectorRetried`, `ConnectorDLQ` events.
- **Related specs:** `docs/12` §33
- **Dependencies:** T-M14-013
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Integrations/Events/*`
- **Acceptance criteria:** All events dispatched; audit and notification listeners react.
- **Required tests:** `tests/Feature/Integrations/ConnectorEventsTest.php`.
- **Status:** Not Started

### T-M14-015 — Connector health endpoint
- **Milestone:** M14
- **Title:** Connector health endpoint
- **Description:** `GET /api/v1/admin/integrations/{id}/health`; returns availability, latency, success rate, last call.
- **Related specs:** `docs/12` §19
- **Dependencies:** T-M14-014
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Integrations/Http/Controllers/Admin/ConnectorHealthController.php`
- **Acceptance criteria:** Endpoint returns aggregate metrics.
- **Required tests:** `tests/Feature/Integrations/HealthEndpointTest.php`.
- **Status:** Not Started

### T-M14-016 — Connector dashboard endpoint
- **Milestone:** M14
- **Title:** Connector dashboard endpoint
- **Description:** `GET /api/v1/admin/integrations/dashboard` with config, health, queue length, DLQ size.
- **Related specs:** `docs/12` §27
- **Dependencies:** T-M14-015
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Integrations/Http/Controllers/Admin/ConnectorDashboardController.php`
- **Acceptance criteria:** Aggregates per connector.
- **Required tests:** `tests/Feature/Integrations/DashboardTest.php`.
- **Status:** Not Started

### T-M14-017 — Seed mock connectors
- **Milestone:** M14
- **Title:** Seed mock connectors
- **Description:** `MockConnectorsSeeder` inserts Mock Challan, Mock Municipality, Mock Notification, Mock GIS connectors.
- **Related specs:** `docs/12` §24
- **Dependencies:** T-M14-016
- **Est. time:** 20 minutes
- **Files:** `backend/database/seeders/MockConnectorsSeeder.php`, `backend/app/Modules/Integrations/Connectors/MockConnector.php`
- **Acceptance criteria:** 4 mock connectors present; enabled in dev.
- **Required tests:** Seed test.
- **Status:** Not Started

### T-M14-018 — ConnectorContractTest
- **Milestone:** M14
- **Title:** ConnectorContractTest
- **Description:** Pest contract test ensuring every concrete adapter implements `ConnectorInterface` and supports the full lifecycle.
- **Related specs:** `docs/12` §29
- **Dependencies:** T-M14-008
- **Est. time:** 25 minutes
- **Files:** `backend/tests/Unit/Integrations/ConnectorContractTest.php`
- **Acceptance criteria:** All adapters pass.
- **Required tests:** `vendor/bin/pest tests/Unit/Integrations/ConnectorContractTest.php`.
- **Status:** Not Started

### T-M14-019 — PII masking for connector payloads
- **Milestone:** M14
- **Title:** PII masking for connector payloads
- **Description:** Reuse `PiiMaskingService` to strip mobile/email from outbound payloads; configurable per connector.
- **Related specs:** `docs/11` §28; `docs/12` §22
- **Dependencies:** T-M8-011
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Integrations/Support/PayloadMasker.php`
- **Acceptance criteria:** Test asserts no mobile in outbound payload.
- **Required tests:** `tests/Feature/Integrations/PayloadMaskerTest.php`.
- **Status:** Not Started

### T-M14-020 — Idempotency-Key propagation
- **Milestone:** M14
- **Title:** Idempotency-Key propagation
- **Description:** Every outbound request carries an `Idempotency-Key` derived from `request_id`; framework stamps tracking number.
- **Related specs:** `docs/12` §23
- **Dependencies:** T-M14-013
- **Est. time:** 15 minutes
- **Files:** `backend/app/Modules/Integrations/Support/IdempotencyKey.php`
- **Acceptance criteria:** Header present in all outbound calls.
- **Required tests:** `tests/Feature/Integrations/IdempotencyKeyTest.php`.
- **Status:** Not Started

### T-M14-021 — Static analysis rule for direct HTTP usage
- **Milestone:** M14
- **Title:** Static analysis rule for direct HTTP usage
- **Description:** PHPStan custom rule rejecting `Http::` outside `app/Modules/Integrations`.
- **Related specs:** `docs/14` §38
- **Dependencies:** T-M14-007
- **Est. time:** 25 minutes
- **Files:** `backend/phpstan.neon`, `backend/app/Modules/Integrations/Phpstan/ForbiddenHttpCallRule.php`
- **Acceptance criteria:** `vendor/bin/phpstan analyse` fails when `Http::` is used outside Integrations.
- **Required tests:** `tests/Feature/Integrations/PhpstanRuleTest.php`.
- **Status:** Not Started

### T-M14-022 — Connector CRUD endpoints
- **Milestone:** M14
- **Title:** Connector CRUD endpoints
- **Description:** `AdminIntegrationController` exposes list/create/update/delete/enable/disable; secrets never serialized.
- **Related specs:** `docs/12` §34
- **Dependencies:** T-M14-016
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Integrations/Http/Controllers/Admin/AdminIntegrationController.php`
- **Acceptance criteria:** CRUD works; secrets masked.
- **Required tests:** `tests/Feature/Integrations/AdminIntegrationCrudTest.php`.
- **Status:** Not Started

### T-M14-023 — Update OpenAPI for integrations
- **Milestone:** M14
- **Title:** Update OpenAPI for integrations
- **Description:** Add admin endpoints and webhook callbacks to `openapi.yaml`.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M14-022
- **Est. time:** 20 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `swagger-cli validate` passes.
- **Required tests:** `tests/Feature/OpenApiIntegrationsTest.php`.
- **Status:** Not Started

### T-M14-024 — Author docs/integrations.md
- **Milestone:** M14
- **Title:** Author docs/integrations.md
- **Description:** Connector authoring guide, retry/DLQ semantics, health, secrets.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M14-023
- **Est. time:** 25 minutes
- **Files:** `docs/integrations.md`
- **Acceptance criteria:** Doc has an end-to-end example.
- **Required tests:** Manual.
- **Status:** Not Started


---

## Milestone M15 — Security, Anti-Fraud & Compliance Hardening

**Source:** `.codex/roadmap.md` §M15. **Specs:** `docs/11` (entire — esp. §16, §19, §20, §22, §24–28, §30, §31, §34, §38, §40); `docs/15` §16–19, §38, §39.

---

### T-M15-001 — Edge rate limiters per role
- **Milestone:** M15
- **Title:** Edge rate limiters per role
- **Description:** Register `citizen`, `otp`, `uploads`, `anonymous`, `moderator`, `department`, `admin` limiters; apply in middleware groups.
- **Related specs:** `docs/11` §21
- **Dependencies:** T-M2-022
- **Est. time:** 30 minutes
- **Files:** `backend/app/Providers/RouteServiceProvider.php`, `backend/routes/api.php`
- **Acceptance criteria:** Each role's documented limit enforced.
- **Required tests:** `tests/Feature/Security/RateLimitersTest.php`.
- **Status:** Not Started

### T-M15-002 — Anonymous reporting flow
- **Milestone:** M15
- **Title:** Anonymous reporting flow
- **Description:** When `is_anonymous=true`, the citizen's identity is replaced with a hash; the report is not linkable back to the user; rate-limited tighter.
- **Related specs:** `docs/11` §21
- **Dependencies:** T-M4-017
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Reports/Services/ReportService.php`
- **Acceptance criteria:** Anonymous report is unlinkable; `audit_logs` never contains mobile.
- **Required tests:** `tests/Feature/Reports/AnonymousFlowTest.php`.
- **Status:** Not Started

### T-M15-003 — Behavioural risk engine
- **Milestone:** M15
- **Title:** Behavioural risk engine
- **Description:** `RiskEngine::score(User, Report?): int` aggregates reports/hour, average upload time, failed logins, mock-GPS signals, replay signals; returns 0–100.
- **Related specs:** `docs/11` §19
- **Dependencies:** T-M2-021
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Security/Services/RiskEngine.php`
- **Acceptance criteria:** Each input affects score; thresholds in config.
- **Required tests:** `tests/Feature/Security/RiskEngineTest.php`.
- **Status:** Not Started

### T-M15-004 — Risk-based auto-actions
- **Milestone:** M15
- **Title:** Risk-based auto-actions
- **Description:** Listener reacts to risk score: `0-25` trusted, `26-50` monitor, `51-75` moderator review, `76-100` restrict. Auto-decisions are auditable.
- **Related specs:** `docs/11` §20
- **Dependencies:** T-M15-003
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Security/Listeners/RiskActionListener.php`
- **Acceptance criteria:** Score 90 restricts the user; score 30 logs only.
- **Required tests:** `tests/Feature/Security/RiskActionTest.php`.
- **Status:** Not Started

### T-M15-005 — Security policies CRUD (admin)
- **Milestone:** M15
- **Title:** Security policies CRUD (admin)
- **Description:** Admin endpoints to manage password policy, OTP expiry, JWT lifetime, rate limits, allowed countries, retention, feature flags.
- **Related specs:** `docs/11` §40
- **Dependencies:** T-M3-018
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Security/Http/Controllers/Admin/AdminSecurityPolicyController.php`
- **Acceptance criteria:** Changes apply without redeploy.
- **Required tests:** `tests/Feature/Security/AdminSecurityPolicyTest.php`.
- **Status:** Not Started

### T-M15-006 — Ban and suspension workflow
- **Milestone:** M15
- **Title:** Ban and suspension workflow
- **Description:** `BanService` with `warn`, `restrict`, `temporaryBan`, `permanentBan`, `restore`; records `reason`, `evidence`, `administrator`, `expiry`, `appeal_status`.
- **Related specs:** `docs/11` §30
- **Dependencies:** T-M15-005
- **Est. time:** 30 minutes
- **Files:** `backend/app/Modules/Security/Services/BanService.php`
- **Acceptance criteria:** Banned user gets 403 on every endpoint.
- **Required tests:** `tests/Feature/Security/BanServiceTest.php`.
- **Status:** Not Started

### T-M15-007 — Appeal workflow
- **Milestone:** M15
- **Title:** Appeal workflow
- **Description:** `AppealService::open`, `decide`; on restore, user is unbanned; on reject, ban stands.
- **Related specs:** `docs/11` §31
- **Dependencies:** T-M15-006
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Security/Services/AppealService.php`
- **Acceptance criteria:** Appeal can be opened by the user and decided by an admin.
- **Required tests:** `tests/Feature/Security/AppealServiceTest.php`.
- **Status:** Not Started

### T-M15-008 — Security headers middleware
- **Milestone:** M15
- **Title:** Security headers middleware
- **Description:** `SecurityHeaders` middleware adds HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP.
- **Related specs:** `docs/11` §25
- **Dependencies:** T-M15-007
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Security/Http/Middleware/SecurityHeaders.php`
- **Acceptance criteria:** All headers present on every response.
- **Required tests:** `tests/Feature/Security/SecurityHeadersTest.php`.
- **Status:** Not Started

### T-M15-009 — CORS and CSRF hardening
- **Milestone:** M15
- **Title:** CORS and CSRF hardening
- **Description:** Configure CORS allow-list; verify Sanctum stateful CSRF on web; reject mismatched origin.
- **Related specs:** `docs/11` §24
- **Dependencies:** T-M15-008
- **Est. time:** 25 minutes
- **Files:** `backend/config/cors.php`, `backend/app/Http/Middleware/VerifyCsrfToken.php`
- **Acceptance criteria:** Disallowed origin blocked.
- **Required tests:** `tests/Feature/Security/CorsTest.php`.
- **Status:** Not Started

### T-M15-010 — Encrypted PII columns
- **Milestone:** M15
- **Title:** Encrypted PII columns
- **Description:** Eloquent cast `encrypted:array` (or `Crypt::encryptString`) on `users.name`, `users.email`, `reports.title`/`description` if contains PII, etc.
- **Related specs:** `docs/11` §26
- **Dependencies:** T-M15-005
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Users/Models/User.php`, `backend/app/Modules/Reports/Models/Report.php`
- **Acceptance criteria:** Plain text never appears in DB.
- **Required tests:** `tests/Feature/Security/EncryptedColumnsTest.php`.
- **Status:** Not Started

### T-M15-011 — Secret rotation runbook
- **Milestone:** M15
- **Title:** Secret rotation runbook
- **Description:** Author `docs/secrets.md` covering rotation of JWT keys, OTP HMAC, AI API keys, integration secrets; include `php artisan key:rotate`.
- **Related specs:** `docs/11` §26
- **Dependencies:** T-M15-010
- **Est. time:** 25 minutes
- **Files:** `docs/secrets.md`, `backend/app/Console/Commands/RotateSecrets.php`
- **Acceptance criteria:** Runbook has step-by-step.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M15-012 — Security dashboard endpoint
- **Milestone:** M15
- **Title:** Security dashboard endpoint
- **Description:** `GET /api/v1/admin/security/dashboard` returns failed logins, locked users, rate-limited users, fraud trends, blocked devices, storage integrity.
- **Related specs:** `docs/11` §34
- **Dependencies:** T-M15-007
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Security/Http/Controllers/Admin/SecurityDashboardController.php`
- **Acceptance criteria:** Aggregations correct.
- **Required tests:** `tests/Feature/Security/SecurityDashboardTest.php`.
- **Status:** Not Started

### T-M15-013 — Dependency scan in CI
- **Milestone:** M15
- **Title:** Dependency scan in CI
- **Description:** Add `composer audit` and `npm audit --omit=dev` to `.github/workflows/ci.yml`; fail on high severity.
- **Related specs:** `docs/15` §34
- **Dependencies:** T-M15-005
- **Est. time:** 20 minutes
- **Files:** `.github/workflows/ci.yml`
- **Acceptance criteria:** CI fails on known high CVE.
- **Required tests:** Manual test with a known-vulnerable package.
- **Status:** Not Started

### T-M15-014 — Container scan in CI
- **Milestone:** M15
- **Title:** Container scan in CI
- **Description:** Add Trivy scan to the docker-build job; fail on Critical/High.
- **Related specs:** `docs/15` §34
- **Dependencies:** T-M15-013
- **Est. time:** 20 minutes
- **Files:** `.github/workflows/ci.yml`
- **Acceptance criteria:** Critical CVE fails the job.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M15-015 — OWASP ZAP baseline scan
- **Milestone:** M15
- **Title:** OWASP ZAP baseline scan
- **Description:** Add a ZAP baseline job running against the staging API; fail on high alerts.
- **Related specs:** `docs/15` §16
- **Dependencies:** T-M15-014
- **Est. time:** 25 minutes
- **Files:** `.github/workflows/zap.yml`
- **Acceptance criteria:** Workflow uploads report artifact.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M15-016 — Static analysis strictness
- **Milestone:** M15
- **Title:** Static analysis strictness
- **Description:** Tighten PHPStan to ignore-pattern free; ESLint `--max-warnings 0`; pre-commit hook runs both.
- **Related specs:** `docs/14` §30
- **Dependencies:** T-M15-015
- **Est. time:** 25 minutes
- **Files:** `backend/phpstan.neon`, `frontend/eslint.config.js`, `.husky/pre-commit`
- **Acceptance criteria:** Pre-commit blocks on warnings.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M15-017 — OWASP Top 10 regression tests
- **Milestone:** M15
- **Title:** OWASP Top 10 regression tests
- **Description:** Pest feature suite covering SQLi, XSS, SSRF, path traversal, IDOR, replay, mass assignment, broken auth, sensitive data exposure, CSRF.
- **Related specs:** `docs/15` §16
- **Dependencies:** T-M15-016
- **Est. time:** 30 minutes
- **Files:** `backend/tests/Feature/Security/OwaspRegressionTest.php`
- **Acceptance criteria:** All cases green.
- **Required tests:** `vendor/bin/pest tests/Feature/Security/OwaspRegressionTest.php`.
- **Status:** Not Started

### T-M15-018 — Abuse detection
- **Milestone:** M15
- **Title:** Abuse detection
- **Description:** `AbuseDetector` flags repeated OTP requests, API scanning, credential stuffing, mass uploads, token reuse, suspicious user agents.
- **Related specs:** `docs/11` §22
- **Dependencies:** T-M15-017
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Security/Services/AbuseDetector.php`
- **Acceptance criteria:** Detected patterns raise security events.
- **Required tests:** `tests/Feature/Security/AbuseDetectorTest.php`.
- **Status:** Not Started

### T-M15-019 — Audit-log immutability enforcement
- **Milestone:** M15
- **Title:** Audit-log immutability enforcement
- **Description:** DB triggers or model events that block `update` and `delete` on `audit_logs`; integration test.
- **Related specs:** `docs/11` §28
- **Dependencies:** T-M2-020
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Security/Models/AuditLog.php`
- **Acceptance criteria:** Update/delete raises `LogicException`.
- **Required tests:** `tests/Feature/Security/AuditImmutabilityTest.php`.
- **Status:** Not Started

### T-M15-020 — File upload security hardening
- **Milestone:** M15
- **Title:** File upload security hardening
- **Description:** Reject files with mismatched MIME, missing magic bytes, executable extensions; magic-bytes whitelist.
- **Related specs:** `docs/11` §32
- **Dependencies:** T-M5-004
- **Est. time:** 25 minutes
- **Files:** `backend/app/Modules/Media/Services/MimeValidator.php`
- **Acceptance criteria:** Renamed EXE rejected.
- **Required tests:** `tests/Feature/Media/UploadHardeningTest.php`.
- **Status:** Not Started

### T-M15-021 — Backup encryption
- **Milestone:** M15
- **Title:** Backup encryption
- **Description:** `Backup` job encrypts DB dump and uploads to MinIO with versioning; integrity hash recorded.
- **Related specs:** `docs/11` §37
- **Dependencies:** T-M15-011
- **Est. time:** 25 minutes
- **Files:** `backend/app/Console/Commands/EncryptedBackup.php`
- **Acceptance criteria:** Restore succeeds from encrypted backup.
- **Required tests:** `tests/Feature/Security/BackupEncryptionTest.php`.
- **Status:** Not Started

### T-M15-022 — Penetration test report template
- **Milestone:** M15
- **Title:** Penetration test report template
- **Description:** `docs/pen-test.md` template + checklist for `docs/15` §38.
- **Related specs:** `docs/15` §38
- **Dependencies:** T-M15-021
- **Est. time:** 20 minutes
- **Files:** `docs/pen-test.md`
- **Acceptance criteria:** Template covers OWASP Top 10 and API Security Top 10.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M15-023 — Update OpenAPI for security endpoints
- **Milestone:** M15
- **Title:** Update OpenAPI for security endpoints
- **Description:** Add security admin endpoints to `openapi.yaml`.
- **Related specs:** `docs/05` §23
- **Dependencies:** T-M15-012
- **Est. time:** 20 minutes
- **Files:** `backend/storage/api-docs/openapi.yaml`
- **Acceptance criteria:** `swagger-cli validate` passes.
- **Required tests:** `tests/Feature/OpenApiSecurityTest.php`.
- **Status:** Not Started

### T-M15-024 — Author docs/security.md
- **Milestone:** M15
- **Title:** Author docs/security.md
- **Description:** Author comprehensive `docs/security.md` covering all controls, rotation, runbook, incident response.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M15-023
- **Est. time:** 30 minutes
- **Files:** `docs/security.md`
- **Acceptance criteria:** Doc references all 11 specs sections it implements.
- **Required tests:** Manual.
- **Status:** Not Started


---

## Milestone M16 — Production Hardening, Observability & Release

**Source:** `.codex/roadmap.md` §M16. **Specs:** `docs/03` §24; `docs/14` §29, §32, §33; `docs/15` §32, §36, §39.

---

### T-M16-001 — Structured JSON logging
- **Milestone:** M16
- **Title:** Structured JSON logging
- **Description:** `config/logging.php` configures a `json` channel; `LogMacro::event($name, $context)` helper; `RequestId` propagated to every log line.
- **Related specs:** `docs/03` §18; `docs/14` §19
- **Dependencies:** T-M1-020
- **Est. time:** 25 minutes
- **Files:** `backend/config/logging.php`, `backend/app/Modules/Shared/Logging/EventLog.php`
- **Acceptance criteria:** All logs are valid JSON with `trace_id`.
- **Required tests:** `tests/Feature/Shared/JsonLoggingTest.php`.
- **Status:** Not Started

### T-M16-002 — Metrics endpoint (Prometheus)
- **Milestone:** M16
- **Title:** Metrics endpoint (Prometheus)
- **Description:** `GET /metrics` exposes request counters, queue depth, AI latency, error rates; uses `promphp/prometheus_client_php`.
- **Related specs:** `docs/14` §32
- **Dependencies:** T-M16-001
- **Est. time:** 30 minutes
- **Files:** `backend/app/Http/Controllers/MetricsController.php`
- **Acceptance criteria:** Endpoint returns valid Prometheus text format.
- **Required tests:** `tests/Feature/Shared/MetricsTest.php`.
- **Status:** Not Started

### T-M16-003 — Error tracking integration
- **Milestone:** M16
- **Title:** Error tracking integration
- **Description:** Wire Sentry-compatible error tracking; redact PII before send.
- **Related specs:** `docs/14` §32
- **Dependencies:** T-M16-001
- **Est. time:** 25 minutes
- **Files:** `backend/config/sentry.php` (or `app.php` wiring)
- **Acceptance criteria:** Triggered error reports to tracker without PII.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-004 — Kubernetes-style health endpoints
- **Milestone:** M16
- **Title:** Kubernetes-style health endpoints
- **Description:** `GET /health/live`, `/health/ready`, `/health/startup` per docs/15 §27.
- **Related specs:** `docs/15` §27
- **Dependencies:** T-M1-020
- **Est. time:** 20 minutes
- **Files:** `backend/app/Http/Controllers/HealthController.php`
- **Acceptance criteria:** Endpoints respond 200/503 as configured.
- **Required tests:** `tests/Feature/HealthCheckTest.php`.
- **Status:** Not Started

### T-M16-005 — Uptime checks
- **Milestone:** M16
- **Title:** Uptime checks
- **Description:** `UptimeCheckJob` periodically pings the live deployment and writes a heartbeat row.
- **Related specs:** `docs/14` §32
- **Dependencies:** T-M16-004
- **Est. time:** 20 minutes
- **Files:** `backend/app/Modules/Shared/Jobs/UptimeCheckJob.php`
- **Acceptance criteria:** Heartbeat row every 60s.
- **Required tests:** `tests/Feature/Shared/UptimeCheckTest.php`.
- **Status:** Not Started

### T-M16-006 — Encrypted backup job
- **Milestone:** M16
- **Title:** Encrypted backup job
- **Description:** `Backup` scheduled job runs daily, encrypts DB dump, uploads to MinIO; restore drill test.
- **Related specs:** `docs/14` §33; `docs/15` §39
- **Dependencies:** T-M16-001
- **Est. time:** 30 minutes
- **Files:** `backend/app/Console/Commands/RunBackup.php`, `backend/app/Modules/Shared/Jobs/RunBackupJob.php`
- **Acceptance criteria:** Backup file appears in MinIO; restore works locally.
- **Required tests:** `tests/Feature/Shared/BackupTest.php`.
- **Status:** Not Started

### T-M16-007 — Staging deployment workflow
- **Milestone:** M16
- **Title:** Staging deployment workflow
- **Description:** `.github/workflows/deploy-staging.yml` on `main` builds, pushes, runs migrations, and restarts the stack.
- **Related specs:** `docs/14` §29
- **Dependencies:** T-M16-006
- **Est. time:** 30 minutes
- **Files:** `.github/workflows/deploy-staging.yml`
- **Acceptance criteria:** Successful run on a feature branch merge.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-008 — Production deployment workflow
- **Milestone:** M16
- **Title:** Production deployment workflow
- **Description:** `.github/workflows/deploy-production.yml` on tag `v*` with manual approval gate.
- **Related specs:** `docs/14` §29
- **Dependencies:** T-M16-007
- **Est. time:** 25 minutes
- **Files:** `.github/workflows/deploy-production.yml`
- **Acceptance criteria:** Manual approval required; rollback step included.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-009 — Smoke test pipeline
- **Milestone:** M16
- **Title:** Smoke test pipeline
- **Description:** Post-deploy smoke test job runs login, dashboard, report submission, queue, AI, notifications, health.
- **Related specs:** `docs/15` §27
- **Dependencies:** T-M16-008
- **Est. time:** 25 minutes
- **Files:** `.github/workflows/smoke.yml`
- **Acceptance criteria:** Smoke tests pass after staging deploy.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-010 — Runbook: deploy and rollback
- **Milestone:** M16
- **Title:** Runbook: deploy and rollback
- **Description:** `docs/runbooks/deploy-rollback.md` with pre-deploy checklist, deploy steps, rollback steps, on-call contacts.
- **Related specs:** `docs/14` §29
- **Dependencies:** T-M16-008
- **Est. time:** 25 minutes
- **Files:** `docs/runbooks/deploy-rollback.md`
- **Acceptance criteria:** Runbook covers happy + rollback.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-011 — Runbook: AI provider failover
- **Milestone:** M16
- **Title:** Runbook: AI provider failover
- **Description:** `docs/runbooks/ai-failover.md` covering provider health, manual failover, prompt rollback.
- **Related specs:** `docs/10` §27
- **Dependencies:** T-M16-010
- **Est. time:** 20 minutes
- **Files:** `docs/runbooks/ai-failover.md`
- **Acceptance criteria:** Runbook has step-by-step.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-012 — Runbook: connector DLQ drain
- **Milestone:** M16
- **Title:** Runbook: connector DLQ drain
- **Description:** `docs/runbooks/connector-dlq.md` covering inspection, retry, cancellation.
- **Related specs:** `docs/12` §17
- **Dependencies:** T-M16-011
- **Est. time:** 20 minutes
- **Files:** `docs/runbooks/connector-dlq.md`
- **Acceptance criteria:** Runbook has step-by-step.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-013 — Runbook: ban appeal
- **Milestone:** M16
- **Title:** Runbook: ban appeal
- **Description:** `docs/runbooks/ban-appeal.md` covering review, decision, restore.
- **Related specs:** `docs/11` §31
- **Dependencies:** T-M16-012
- **Est. time:** 20 minutes
- **Files:** `docs/runbooks/ban-appeal.md`
- **Acceptance criteria:** Runbook has step-by-step.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-014 — k6 load test scripts
- **Milestone:** M16
- **Title:** k6 load test scripts
- **Description:** Author `scripts/load/k6-*.js` for citizen submit, moderator queue, AI pipeline, public dashboard; targets per `docs/02` §18.
- **Related specs:** `docs/15` §18
- **Dependencies:** T-M16-009
- **Est. time:** 30 minutes
- **Files:** `scripts/load/*`
- **Acceptance criteria:** 1,000 VU for 5 min passes on staging.
- **Required tests:** `k6 run`.
- **Status:** Not Started

### T-M16-015 — Staging performance report
- **Milestone:** M16
- **Title:** Staging performance report
- **Description:** `reports/performance-v1.0.md` capturing p50/p95 latencies, throughput, error rates against targets.
- **Related specs:** `docs/15` §18
- **Dependencies:** T-M16-014
- **Est. time:** 25 minutes
- **Files:** `reports/performance-v1.0.md`
- **Acceptance criteria:** Numbers match documented targets.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-016 — Release readiness sign-off
- **Milestone:** M16
- **Title:** Release readiness sign-off
- **Description:** `reports/release-readiness-v1.0.md` checklist per `docs/15` §39 with sign-offs.
- **Related specs:** `docs/15` §39
- **Dependencies:** T-M16-015
- **Est. time:** 25 minutes
- **Files:** `reports/release-readiness-v1.0.md`
- **Acceptance criteria:** All boxes checked or risk-accepted.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-017 — Production cutover rehearsal
- **Milestone:** M16
- **Title:** Production cutover rehearsal
- **Description:** Run the production cutover checklist on staging; record issues and remediate.
- **Related specs:** `docs/15` §36
- **Dependencies:** T-M16-016
- **Est. time:** 30 minutes
- **Files:** `reports/cutover-rehearsal-v1.0.md`
- **Acceptance criteria:** Rehearsal passes; report filed.
- **Required tests:** Manual.
- **Status:** Not Started

### T-M16-018 — Author release notes v1.0
- **Milestone:** M16
- **Title:** Author release notes v1.0
- **Description:** `CHANGELOG.md` and `RELEASE_NOTES.md` summarizing V1.
- **Related specs:** `docs/14` §37
- **Dependencies:** T-M16-017
- **Est. time:** 20 minutes
- **Files:** `CHANGELOG.md`, `RELEASE_NOTES.md`
- **Acceptance criteria:** Notes include feature list, breaking changes (none), upgrade path.
- **Required tests:** Manual.
- **Status:** Not Started

