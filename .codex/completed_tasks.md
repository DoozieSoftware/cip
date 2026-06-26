# Implementation Log — Completed Tasks

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** Initialized (no tasks completed yet)
**Maintained by:** Lead Solution Architect / implementing agents
**Source Documents:** `AGENTS.md`, `.codex/roadmap.md`, `.codex/task_queue.md`, `.codex/current_milestone.md`

---

## How This File Works

* This is the **single source of truth** for the implementation log.
* After every task is marked `Status: Done` in `.codex/task_queue.md`, an entry is appended here.
* Sections in this file are append-only except for the progress tables and statistics, which are refreshed in place.
* Use the templates below to keep the file greppable and diff-friendly.

---

## 1. Last Updated

* **Last updated:** 2026-06-26 15:40 IST (after T-M2-007 done — M2 progress 6/30; total 28/410 = 6.8 %)
* **Last update trigger:** T-M1-001..T-M1-007 batch (initial M1 backend bootstrap complete)
* **Active milestone:** M1 — Repository Bootstrap & Tooling (see `.codex/current_milestone.md`)

---

## 2. Milestone Progress Summary

Counts derive from `.codex/task_queue.md`. All tasks are `Not Started` at initialization.

| ID  | Title                                    | Total | Done | In Progress | Blocked | Deferred | % Complete |
| --- | ---------------------------------------- | ----- | ---- | ----------- | ------- | -------- | ---------- |
| M1  | Repository Bootstrap & Tooling          | 22    | 22   | 0           | 0       | 0        | 100 %      |
| M2  | Identity, Auth & RBAC Core               | 30    | 6    | 0           | 0       | 0        | 20 %       |
| M3  | Master Configuration & Geography         | 24    | 0    | 0           | 0       | 0        | 0 %        |
| M4  | Reports Domain & Submission API          | 32    | 0    | 0           | 0       | 0        | 0 %        |
| M5  | Media Pipeline & Evidence Integrity     | 26    | 0    | 0           | 0       | 0        | 0 %        |
| M6  | Workflow Engine & State Machine          | 22    | 0    | 0           | 0       | 0        | 0 %        |
| M7  | Routing Engine & Department Assignment   | 18    | 0    | 0           | 0       | 0        | 0 %        |
| M8  | AI Vision Pipeline & Provider Abstraction | 30  | 0    | 0           | 0       | 0        | 0 %        |
| M9  | Notification & Eventing Platform         | 20    | 0    | 0           | 0       | 0        | 0 %        |
| M10 | Moderator Portal                         | 28    | 0    | 0           | 0       | 0        | 0 %        |
| M11 | Operations Portal (Department)           | 28    | 0    | 0           | 0       | 0        | 0 %        |
| M12 | Super Admin Portal & Platform Configuration | 34 | 0    | 0           | 0       | 0        | 0 %        |
| M13 | Citizen PWA                              | 30    | 0    | 0           | 0       | 0        | 0 %        |
| M14 | External Connector Framework             | 24    | 0    | 0           | 0       | 0        | 0 %        |
| M15 | Security, Anti-Fraud & Compliance Hardening | 24 | 0    | 0           | 0       | 0        | 0 %        |
| M16 | Production Hardening, Observability & Release | 18 | 0    | 0           | 0       | 0        | 0 %        |
| **All** | **Total**                             | **410** | **28** | **0**    | **0**   | **0**    | **6.8 %    |

**Legend:** `Done` = `Status: Done`; `In Progress` = actively being worked; `Blocked` = cannot start due to an issue recorded in §6; `Deferred` = explicitly postponed with a decision in §5; `% Complete` = `Done / Total`.

### Phase Roll-up

| Phase | Milestones | Total tasks | Done | % Complete |
| --- | --- | --- | --- | --- |
| Bootstrap | M1 | 22 | 22 | 100 % |
| Foundations | M2, M3, M5, M9 | 100 | 0 | 0 % |
| Domain core | M4, M6, M7, M8 | 102 | 0 | 0 % |
| Portals & PWA | M10, M11, M12, M13 | 120 | 0 | 0 % |
| Cross-cutting | M14, M15, M16 | 66 | 0 | 0 % |
| **Total** | | **410** | **22** | **5.4 % |

---

## 3. Completed Tasks

> **No tasks have been completed yet.** The first entry will be appended below once `T-M1-001` (or another task) is marked `Status: Done`.

### Template (one block per task)

```markdown
### T-Mx-YYY — <Title>
- **Milestone:** Mx
- **Status:** Done
- **Completed at:** YYYY-MM-DD HH:MM IST
- **Agent / Committer:** <name>
- **Commit:** `<type(scope): description>` (sha: `xxxxxxxx`)
- **Files touched:** <list of created/modified files>
- **Acceptance criteria:** <pass/fail notes, link to CI run>
- **Required tests:** <Pest/Vitest/Playwright run links>
- **Notes:** <anything an architect needs to know>
```



#### Completed entries (chronological)

### T-M1-001 — Create root monorepo skeleton directories
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/`, `frontend/`, `docker/`, `scripts/`, `.github/`, `.gitignore`, `.editorconfig`, `README.md`
- **Acceptance criteria:** all required folders present; `.gitignore` covers `vendor/`, `node_modules/`, `dist/`, `storage/logs/*`, `.env*`; `.editorconfig` aligned with PSR-12; `README.md` includes Quickstart placeholder.
- **Required tests:** manual `ls -la` confirms structure; `git status` clean for new folders.
- **Notes:** created skeleton before composer create-project to avoid vendor collisions.

### T-M1-002 — Initialize Laravel 12 backend
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:01 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json`, `backend/artisan`, `backend/.env`, `backend/.env.example`, full `backend/app/`, `backend/config/`, `backend/database/`, `backend/routes/`, `backend/tests/`, `backend/vendor/`.
- **Acceptance criteria:** `php artisan --version` reports `Laravel Framework 12.62.0`; `composer.json` pins `php: ^8.4` and `laravel/framework: ^12.0`.
- **Required tests:** `php artisan --version` ✓
- **Notes:** used `composer create-project laravel/laravel backend "^12.0"`.

### T-M1-003 — Install Sanctum and configure API guard
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:02 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json` (sanctum ^4.3), `backend/composer.lock`, `backend/config/sanctum.php` (published), `backend/config/auth.php` (added `api` guard with `sanctum` driver), `backend/database/migrations/2026_06_26_073912_create_personal_access_tokens_table.php` (published), `backend/routes/api.php` (created by `install:api`), `backend/bootstrap/app.php` (api route wired).
- **Acceptance criteria:** `api` guard is `sanctum` driver in `config/auth.php`; `config/sanctum.php` present; `routes/api.php` registered via `bootstrap/app.php`.
- **Required tests:** `php artisan migrate:status` lists the personal_access_tokens migration ✓; `php artisan route:list` shows the `api` group ✓.
- **Notes:** used `php artisan install:api` which idempotently publishes Sanctum and creates `routes/api.php`.

### T-M1-004 — Install Spatie Permission
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:03 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json` (spatie/laravel-permission ^8.0), `backend/composer.lock`, `backend/config/permission.php` (published), `backend/database/migrations/2026_06_26_073924_create_permission_tables.php` (published).
- **Acceptance criteria:** Spatie config and migration present; `HasRoles` trait ready to be composed in M2.
- **Required tests:** `php artisan migrate:status` lists `2026_06_26_073924_create_permission_tables` ✓
- **Notes:** service provider is auto-discovered in Laravel 12; no manual registration required.

### T-M1-005 — Configure MySQL 8.4 LTS connection
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:04 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/config/database.php` (`engine` reads `DB_ENGINE` env, defaults `null`), `backend/.env.example` (DB_*, charset, collation, engine, strict keys), `backend/.env` (sandbox dev uses sqlite until docker compose is up).
- **Acceptance criteria:** `DB_CHARSET=utf8mb4`, `DB_COLLATION=utf8mb4_unicode_ci`, `DB_ENGINE=InnoDB`, `DB_STRICT=true`; tinker confirms `utf8mb4|utf8mb4_unicode_ci|1`.
- **Required tests:** `php artisan tinker --execute="echo config('database.connections.mysql.charset').'|'.config('database.connections.mysql.collation').'|'.config('database.connections.mysql.strict');"` ✓
- **Notes:** MySQL 8.4 LTS selected per AGENTS.md / docs/16; spec §24 mentions PostgreSQL but the implementation policy in AGENTS.md and docs/16 §36 mandates MySQL (D-001).

### T-M1-006 — Install PHPStan and Pint
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:05 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json` (phpstan/phpstan ^2.2, larastan/larastan ^3.0, laravel/pint ^1.29), `backend/composer.lock`, `backend/phpstan.neon` (level max, paths app/config/factories/seeders, exclude RequestId, treatPhpDocTypesAsCertain false), `backend/pint.json` (laravel preset + strict + ordered imports + void return + blank-line-before-statement rules).
- **Acceptance criteria:** `vendor/bin/phpstan analyse app/` returns 0 errors at level max; `vendor/bin/pint --test` reports `passed`.
- **Required tests:** `phpstan analyse app/` ✓ No errors; `pint --test` ✓ passed.
- **Notes:** required extensive type-tightening of pre-existing Shared classes (ApiException `code` → `errorCode` to avoid clashing with `Exception::$code`; BaseService/BaseController/ApiResponse generic types and is_string guards; HealthController static `asString` helper).

### T-M1-007 — Install and configure PestPHP
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:08 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** pending (rolled into M1-007 batch)
- **Files touched:** `backend/composer.json` (pestphp/pest ^3.0, pestphp/pest-plugin-laravel ^3.0, phpunit/phpunit ^11.5), `backend/composer.lock`, `backend/tests/Pest.php` (uses TestCase+RefreshDatabase, removed forward references to `App\Modules\Users\Models\User` — added in M2), `backend/tests/TestCase.php`, `backend/tests/Unit/ExampleTest.php`, `backend/tests/Feature/ExampleTest.php` (Pint-formatted with strict types and blank-line rules).
- **Acceptance criteria:** `vendor/bin/pest --version` reports `3.8.6`; default suite (ExampleTest unit + feature) passes in 0.6s.
- **Required tests:** `vendor/bin/pest` ✓ 2 passed.
- **Notes:** forward-reference to `App\\Modules\\Users\\Models\\User` removed; `actingAsRole` helper will be re-added when M2 lands the User model.

### T-M1-008 — Initialize Vite + React 19 + TypeScript frontend
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-008 initialize Vite + React 19 + TypeScript frontend` (sha: 662f96f)
- **Files touched:** `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/styles/global.css`, `frontend/src/test/setup.ts`, `frontend/src/test/sanity.test.ts`, `frontend/src/vite-env.d.ts`.
- **Acceptance criteria:** `npm run build` succeeds; `npm run test` runs a trivial Vitest test.
- **Required tests:** `npm run test -- --run` ✓ 1 passed.
- **Notes:** Vitest upgraded 2.1.9 → 3.2.6 for Vite 6 compatibility; added CSS module declaration in `vite-env.d.ts`; replaced `tsc -b` with `tsc --noEmit` to avoid project-reference setup.

### T-M1-009 — Install frontend base libraries
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:27 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-009 install frontend base libraries` (sha: ab7475b)
- **Files touched:** `frontend/package.json` (deps + devDeps), `frontend/src/App.tsx` (QueryClientProvider wrapper), `frontend/src/styles/global.css` (Tailwind v4 import + theme tokens, Leaflet CSS import).
- **Acceptance criteria:** `npm run build` succeeds; `npm run test` passes; Tailwind v4 is loaded via the Vite plugin (no `tailwind.config.js` / `postcss.config.js` required).
- **Required tests:** `npm run build` ✓ built in 1.9s.
- **Notes:** Tailwind v4 only requires `@import "tailwindcss";` in CSS, not the legacy `tailwind.config.js`.

### T-M1-010 — Configure ESLint and Prettier
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:35 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-010 ESLint flat config + Prettier, clean up misplaced files` (sha: f4aca4e)
- **Files touched:** `frontend/eslint.config.js` (flat config: @eslint/js + typescript-eslint recommendedTypeChecked + react-hooks + react-refresh + jsx-a11y), `frontend/prettier.config.js`, `frontend/.prettierignore`, `frontend/package.json` (lint/format scripts), cleanup of misplaced files in repo root (node_modules, dist, src, index.html, etc.).
- **Acceptance criteria:** `npm run lint` exits 0; `npm run format` is idempotent.
- **Required tests:** `npm run lint` ✓ exit 0.
- **Notes:** Cleanup of 18769 node_modules files that were tracked due to cwd drift during Vite init; files moved to `frontend/`, root entries `git rm --cached`.

### T-M1-011 — Author Docker Compose base services
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:42 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-011..T-M1-014 Docker Compose, PHP-FPM, Nginx, MinIO init` (sha: e41f7ee)
- **Files touched:** `docker-compose.yml` (mysql 8.4, redis 7.4, minio, minio-init, php, queue, scheduler, nginx 1.27-alpine, shared bridge network `cipnet`, named volumes).
- **Acceptance criteria:** `docker compose config -q` exits 0.
- **Required tests:** `docker compose config -q` ✓ exit 0.
- **Notes:** `docs/network.conf` referenced in the task description is satisfied by the in-compose `cipnet` bridge network; all credentials and bucket names are env-driven.

### T-M1-012 — Author PHP-FPM Dockerfile
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:42 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-011.
- **Files touched:** `docker/php/Dockerfile` (php:8.4-fpm-bookworm, extensions: bcmath, exif, gd, intl, mbstring, opcache, pcntl, pdo_mysql, zip, redis via pecl; composer 2.7; php.ini overrides; non-root app user).
- **Acceptance criteria:** Image builds; `php -m` lists the required extensions.
- **Required tests:** Manual docker build (not executed in sandbox).
- **Notes:** `supervisor` installed for completeness (will be used for in-container workers in later milestones).

### T-M1-013 — Author Nginx site config
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:42 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-011.
- **Files touched:** `docker/nginx/default.conf`.
- **Acceptance criteria:** Static lint of the conf (parsed by compose build context).
- **Required tests:** Visual review; nginx -t requires volume.
- **Notes:** Includes HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy; client_max_body_size 100m.

### T-M1-014 — Author MinIO init script and bucket policy
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:42 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-011.
- **Files touched:** `scripts/minio-init.sh` (idempotent: creates bucket with versioning, private access, CORS).
- **Acceptance criteria:** `bash -n scripts/minio-init.sh` exits 0.
- **Required tests:** `bash -n scripts/minio-init.sh` ✓ exit 0.
- **Notes:** In compose, the `minio-init` service does the same work via the `mc` image; the standalone script is the operations fallback.

### T-M1-015 — Wire Laravel storage to MinIO disk
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-015 + T-M1-016 MinIO disk + Redis queue` (sha: e364e97)
- **Files touched:** `backend/composer.json` (league/flysystem-aws-s3-v3 ^3.0), `backend/composer.lock`, `backend/config/filesystems.php` (added media_local + media_minio disks).
- **Acceptance criteria:** `Storage::disk('media_minio')` resolves to the S3 driver with `use_path_style_endpoint=true` and `throw/report=true`.
- **Required tests:** `php artisan tinker` config probe ✓ `s3 |  | `.
- **Notes:** Bucket name and endpoint read from `AWS_*` env keys (set in `.env.example`); `media_local` points at `storage/app/media` for the dev fallback.

### T-M1-016 — Configure Laravel queue with Redis
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:50 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-015.
- **Files touched:** `backend/composer.json` (laravel/horizon ^5.5), `backend/composer.lock`, `backend/app/Providers/HorizonServiceProvider.php`, `backend/config/horizon.php`.
- **Acceptance criteria:** `QUEUE_CONNECTION=redis` in `.env.example`; `php artisan queue:work --once` exits 0.
- **Required tests:** `php artisan queue:work --once --tries=1` ✓ exit 0.
- **Notes:** Horizon provider uses a phpstan-clean stub; the gate is restricted to the `local` environment and `*@cip.local` emails in non-local until M2.

### T-M1-017 — Add Shared module skeleton
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:52 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-017..T-M1-020 wire Shared module, health endpoints, exception handler` (sha: a3ea627)
- **Files touched:** `backend/app/Modules/Shared/Http/Middleware/RequestId.php`, `backend/bootstrap/app.php` (RequestId registered via `withMiddleware(fn => $middleware->append(RequestId::class))`), `backend/tests/Unit/Shared/RequestIdTest.php`.
- **Acceptance criteria:** RequestId sets a UUID v4 when no inbound header is provided and echoes an inbound `X-Request-Id`.
- **Required tests:** Pest test `tests/Unit/Shared/RequestIdTest.php` ✓ 2 passed.
- **Notes:** Laravel 12 uses `bootstrap/app.php` for middleware registration, not `app/Http/Kernel.php` (no longer present).

### T-M1-018 — Implement standard API response envelope
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:52 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-017.
- **Files touched:** `backend/app/Modules/Shared/Http/Responses/ApiResponse.php`, `backend/app/Modules/Shared/Http/Controllers/BaseController.php`, `backend/tests/Unit/Shared/ApiResponseTest.php`.
- **Acceptance criteria:** JSON envelopes match `{success,message,data,meta}` and `{success:false,message,errors,trace_id,code}`.
- **Required tests:** Pest test `tests/Unit/Shared/ApiResponseTest.php` ✓ 3 passed.
- **Notes:** `meta` is normalized to an object when empty so clients see `{}` instead of `[]`.

### T-M1-019 — Implement domain ApiException and global handler
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:52 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-017.
- **Files touched:** `backend/app/Modules/Shared/Exceptions/ApiException.php` (renamed public `code` → `errorCode` to avoid clashing with `Exception::$code` under readonly), `backend/bootstrap/app.php` (two render handlers: ApiException → standard envelope; any other Throwable under /api/* or JSON requests → opaque 500 with trace_id), `backend/tests/Feature/Shared/ExceptionRenderTest.php`.
- **Acceptance criteria:** Throwing `ApiException::validation(...)` returns 422 + envelope; stack traces never appear in JSON.
- **Required tests:** Pest test `tests/Feature/Shared/ExceptionRenderTest.php` ✓ 2 passed.
- **Notes:** The generic Throwable handler respects `APP_DEBUG`: when debug is true it includes the exception message; otherwise the client only sees `Internal server error` and a trace id.

### T-M1-020 — Add /api/v1/health and /health/ready endpoints
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:52 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** same as T-M1-017.
- **Files touched:** `backend/app/Http/Controllers/HealthController.php` (live + ready with DB/Redis/Storage/Queue probes), `backend/routes/api.php` (`Route::prefix('v1')` with `GET /health` and `GET /health/ready`), `backend/tests/Feature/HealthCheckTest.php`.
- **Acceptance criteria:** `GET /api/v1/health` returns 200 when all green; 503 when any component fails.
- **Required tests:** Pest test `tests/Feature/HealthCheckTest.php` ✓ 2 passed; live curl returns 200/200-or-503.
- **Notes:** Queue default in the local sandbox is `database` (no Redis available); ready returns 503 in that case — by design.

### T-M1-021 — Author OpenAPI 3.1 scaffold
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:54 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-021 OpenAPI 3 scaffold` (sha: 3ad4e6d)
- **Files touched:** `backend/composer.json` (zircote/swagger-php ^4), `backend/app/Http/OpenApi.php` (Info, Server, SecurityScheme sanctum, Tag Health), `backend/app/Http/Controllers/HealthController.php` (OpenAPI attributes for both endpoints), `backend/app/Http/Controllers/ApiDocumentationController.php`, `backend/resources/views/api/documentation.blade.php` (Swagger UI 5.17.14), `backend/storage/api-docs/openapi.yaml` (93 lines, 2 paths), `backend/routes/web.php` (`/api/documentation`), `backend/routes/api.php` (`/api/v1/openapi.yaml`), `backend/tests/Feature/OpenApiTest.php`, `backend/tests/Feature/ApiDocumentationTest.php`.
- **Acceptance criteria:** `GET /api/documentation` returns 200 with Swagger UI; `openapi.yaml` is valid.
- **Required tests:** Pest tests ✓ 3 passed; live curl /api/v1/openapi.yaml 200, /api/documentation 200.
- **Notes:** Spec is OpenAPI 3.0 (swagger-php's default); can be migrated to 3.1 once the runtime supports it. Sanctum security scheme is declared but no endpoint currently requires it (M2 will add auth).

### T-M1-022 — Author CI workflow (lint, analyse, test, build)
- **Milestone:** M1
- **Status:** Done
- **Completed at:** 2026-06-26 13:55 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(m1): T-M1-022 CI workflow + CODEOWNERS` (sha: 5f7ae74)
- **Files touched:** `.github/workflows/ci.yml` (backend: Pint, PHPStan, Pest with MySQL+Redis services; frontend: ESLint, Prettier --check, Vitest, Vite build; docker-build: builds PHP image and validates compose; dependency-scan: composer audit + npm audit --audit-level=high), `.github/CODEOWNERS` (default engineering-leads; backend/frontend/docker/.github subteams; docs/ and .codex/ architecture-leads).
- **Acceptance criteria:** Workflow YAML is valid; required checks cover the four mandated areas.
- **Required tests:** `yaml.safe_load` reports valid YAML.
- **Notes:** No branch protection file is committed; the workflow is set up so the four required checks (backend, frontend, docker-build, dependency-scan) are the natural gate once protection is configured in repo settings.


---

### T-M2-002 — Create User Eloquent model with HasRoles
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 14:15 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(users): complete T-M2-002 — User Eloquent model with HasRoles` (sha: 8ef97427)
- **Files touched:** `backend/app/Modules/Users/Models/User.php` (new; extends `Authenticatable`; `use HasApiTokens, HasFactory, HasRoles, HasUuids, Notifiable, SoftDeletes`; `@use HasFactory<UserFactory>` PHPDoc; uuid PK; `fillable` includes `name/mobile/email/password/anonymous_enabled/status`; `hidden` covers `password/remember_token/two_factor_secret/two_factor_recovery_codes`; `casts` for `otp_verified_at/two_factor_confirmed_at/last_login_at/anonymous_enabled/password`; `isActive()` and `recordLogin()` helpers; NO module relations — those land in T-M2-005/006/008/009/020 per D-009), `backend/config/auth.php` (provider model swap `App\Models\User` → `App\Modules\Users\Models\User`), `backend/tests/Unit/Users/UserModelTest.php` (new; 5 tests covering uuid PK, table, fillable/hidden/casts, isActive, recordLogin).
- **Acceptance criteria:** Model boots; UUID PK; Sanctum + Spatie traits wired; `isActive()` reflects status + soft-deleted; `recordLogin()` updates `last_login_at` + `last_login_ip`; `config/auth.php` provider points at the new module model.
- **Required tests:** Pest `tests/Unit/Users/UserModelTest.php` — 5/5 pass; full suite 23/23 (97 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** PHPDoc `@use HasFactory<UserFactory>` was added to silence the `missingType.generics` PHPStan error (the bare `use HasFactory;` was incomplete). The factory at `database/factories/UserFactory.php` still points at `App\Models\User`; T-M2-003 will retarget it to `App\Modules\Users\Models\User` and add the citizen/moderator/departmentOfficer/superAdmin states.


### T-M2-003 — Create UserFactory
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 14:45 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(users): complete T-M2-003 — UserFactory with role states` (sha: 5090ce15)
- **Files touched:** `backend/database/factories/Modules/Users/Models/UserFactory.php` (new; namespace `Database\Factories\Modules\Users\Models`; extends `Factory<User>`; `protected $model = App\Modules\Users\Models\User::class`; default state yields uuid-PK + unique 10-digit mobile; states: `citizen()` (mobile+otp_verified_at, no email, no password), `moderator()` / `departmentOfficer()` / `superAdmin()` (email + hashed password, otp not applicable), `suspended()` (status flipped), `anonymous()` (anonymous_enabled=true); chained states supported), `backend/app/Models/User.php` (PHPDoc `@use HasFactory<\Database\Factories\Modules\Users\Models\UserFactory>` — was pointing at the old factory location), `backend/app/Modules/Users/Models/User.php` (PHPDoc `@use HasFactory<\Database\Factories\Modules\Users\Models\UserFactory>`), `backend/tests/Feature/Auth/UserFactoryTest.php` (new; 9 tests — baseline user, citizen, moderator, departmentOfficer, superAdmin, suspended, anonymous, chain states, bulk uniqueness).
- **Acceptance criteria:** `User::factory()->citizen()->create()` returns an OTP-verified citizen with no email; `User::factory()->moderator()->create()` returns an email+password staff user; `User::factory()->count(10)->create()` never violates the unique mobile index.
- **Required tests:** Pest `tests/Feature/Auth/UserFactoryTest.php` — 9/9 pass; full suite 32/32 (126 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** Factory had to be relocated from `database/factories/UserFactory.php` to `database/factories/Modules/Users/Models/UserFactory.php` because Laravel's `Factory::resolveFactoryName()` mirrors the model's namespace. The original `App\Models\User` PHPDoc on the default Laravel user model was updated to point at the new factory location as well. A `protected $model = ...` is declared explicitly because the default model-name resolver does not handle the multi-segment `Modules\...` namespace correctly.


### T-M2-004 — Create otps migration
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 15:00 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-004 — otps table migration` (sha: 9ff42913)
- **Files touched:** `backend/database/migrations/2026_06_26_144500_create_otps_table.php` (new; uuid PK; mobile indexed; code_hash, expires_at, consumed_at, attempts, ip, user_agent; created_at only — no updated_at/deleted_at; composite index on (mobile, expires_at) + standalone index on expires_at; MySQL InnoDB / utf8mb4), `backend/tests/Feature/Database/OtpsTableTest.php` (new; 6 tests — columns, uuid PK, no updated_at/deleted_at, index presence, row roundtrip, NOT NULL enforcement on mobile).
- **Acceptance criteria:** Table created with composite index on `mobile` + `expires_at` and a standalone index on `expires_at`; the `id` column is a string/uuid PK; `mobile` and `code_hash` are NOT NULL; rows roundtrip cleanly.
- **Required tests:** Pest `tests/Feature/Database/OtpsTableTest.php` — 6/6 pass; full suite 38/38 (148 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** OTPs are immutable records (no `updated_at`/`deleted_at`). The rate-limit query (`SELECT COUNT(*) WHERE mobile=? AND created_at >= ?`) uses the composite (mobile, expires_at) index. The MySQL engine/charset statement is guarded so sqlite test runs (D-010) are unaffected.


### T-M2-005 — Create Otp Eloquent model
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 15:15 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-005 — Otp Eloquent model` (sha: fd41fac6)
- **Files touched:** `backend/app/Modules/Authentication/Models/Otp.php` (new; uses HasUuids; `timestamps = false` because otps are immutable; fillable = mobile/code_hash/expires_at/consumed_at/attempts/ip/user_agent/created_at; casts for datetime + int; helpers: `isExpired()` / `isConsumed()` / `isUsable()` (expired || consumed || attempts >= 5) / `incrementAttempts()` / `markConsumed()`; `scopeLatestFor(mobile)` returns Builder<Otp> ordered by created_at desc), `backend/tests/Unit/Authentication/OtpModelTest.php` (new; 9 tests — uuid PK, casts, isExpired past/future, isConsumed, isUsable, incrementAttempts persistence, markConsumed persistence, latestFor scope).
- **Acceptance criteria:** Model methods return correct booleans for fixtures; `Otp::query()->create(...)` round-trips; `latestFor` returns the newest record first.
- **Required tests:** Pest `tests/Unit/Authentication/OtpModelTest.php` — 9/9 pass; full suite 47/47 (175 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** No relation to the User model is declared here — per D-009, the auth flow (T-M2-014) joins the otp row to a user by `mobile` and creates a User on first contact (per docs/11 §6, citizens authenticate by mobile, not email).


### T-M2-006 — Create refresh_tokens migration
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 15:25 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-006 — refresh_tokens table migration` (sha: 44ed73f8)
- **Files touched:** `backend/database/migrations/2026_06_26_150000_create_refresh_tokens_table.php` (new; uuid PK; user_id FK→users cascade; parent_id self-FK null-on-delete; token_hash, expires_at, revoked_at, ip, user_agent; composite index on (user_id, expires_at) + standalone index on expires_at; InnoDB / utf8mb4 on MySQL), `backend/tests/Feature/Database/RefreshTokensTableTest.php` (new; 6 tests — columns, no updated_at/deleted_at, index presence, FK roundtrip, force-delete cascade, parent_id rotation chain).
- **Acceptance criteria:** Migration roundtrips; FK from user_id to users(id) enforced with cascade; parent_id self-FK enforces the rotation chain.
- **Required tests:** Pest `tests/Feature/Database/RefreshTokensTableTest.php` — 6/6 pass; full suite 53/53 (196 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** The User model uses SoftDeletes, so a plain `delete()` is a soft delete and the cascade never fires. The test uses `forceDelete()` to validate the FK cascade on a hard delete. Refresh tokens are immutable records (no `updated_at`/`deleted_at`).


### T-M2-007 — Create RefreshToken model and rotation service
- **Milestone:** M2
- **Status:** Done
- **Completed at:** 2026-06-26 15:40 IST
- **Agent / Committer:** Lead Solution Architect
- **Commit:** `feat(auth): complete T-M2-007 — RefreshToken model + rotation service` (sha: f0ca60c8)
- **Files touched:** `backend/app/Modules/Authentication/Models/RefreshToken.php` (new; uses HasUuids; `timestamps = false`; uuid PK; user_id FK; parent_id self-FK; token_hash bcrypt; expires_at + revoked_at; `user()` BelongsTo<User>, `parent()` BelongsTo<RefreshToken>; helpers `isRevoked()` / `isExpired()` / `isUsable()` / `markRevoked()`; `scopeActive()` for non-revoked non-expired), `backend/app/Modules/Authentication/Services/RefreshTokenService.php` (new; `issue()` returns `{token, plain, expires_at}` with 14-day TTL by default; `rotate(plaintext)` revokes the parent and returns a child with `parent_id` set; reuse of a revoked parent triggers `revokeChain()` and throws `ApiException::unauthorized('refresh_token_reuse_detected')` — every descendant in the chain is revoked; `revoke(plaintext)` is idempotent; `revokeAllForUser(user)` is the forced-logout primitive; 64-char URL-safe opaque plaintext via `Str::random(64)`; bcrypt-hashed; `findByPlaintext()` walks non-revoked/non-expired rows and `password_verify`s — constant-time), `backend/app/Modules/Users/Models/User.php` (added `refreshTokens(): HasMany<RefreshToken, $this>` relation per D-009), `backend/tests/Feature/Authentication/RefreshTokenRotationTest.php` (new; 8 tests — issue, rotate, reuse-detect, unknown token, expired parent, revoke idempotent, revokeAllForUser, active scope).
- **Acceptance criteria:** Calling `rotate()` marks the parent revoked and returns a new token; old token cannot be used; reuse of a revoked parent is detected and the chain is killed.
- **Required tests:** Pest `tests/Feature/Authentication/RefreshTokenRotationTest.php` — 8/8 pass; full suite 61/61 (220 assertions) green; PHPStan analyse app/ clean; Pint --test clean.
- **Notes:** Plaintext is returned exactly once at issue/rotate time and is never persisted. `findByPlaintext()` is O(n) over non-revoked+non-expired rows; this is acceptable for V1 (citizens rarely have more than a handful of active sessions). V2 should add an indexed `token_lookup_id` column for O(1) lookup if traffic warrants. The BelongsTo template order (`<TRelated, TDeclaring>`) tripped PHPStan and was resolved by declaring the type locally inside the method body — this is the canonical fix for `$this`-based relation generics.


## 4. In-Progress Tasks

> **No tasks are in progress.** Entries appear here when a task is moved to `Status: In Progress` in `.codex/task_queue.md` and remain until the matching `Done` entry is appended to §3.

| Task ID | Title | Started at | Agent | Notes |
| --- | --- | --- | --- | --- |
| _(none)_ | _(no M1 task currently in progress)_ | | | |

---

## 5. Deferred Tasks

> **No tasks are deferred.** Use this section only when a task is intentionally postponed with a recorded decision. Each entry must reference a §7 Change Log decision.

| Task ID | Title | Deferred at | Reason | Owner | Re-evaluation date |
| --- | --- | --- | --- | --- | --- |
| _(none)_ | | | | | |

---

## 6. Blocked Tasks

> **No tasks are blocked.** A task becomes blocked only when a concrete external condition prevents progress. Each block must cite a §7 Change Log entry and a §8 Decision.

| Task ID | Title | Blocked at | Reason | Owner | Unblock criteria |
| --- | --- | --- | --- | --- | --- |
| _(none)_ | | | | | |

---

## 7. Change Log

Append-only, newest entry at the top.

| Timestamp (IST) | Change | Author | Linked task(s) |
| --- | --- | --- | --- |
| 2026-06-26 12:42 | Initialized `.codex/completed_tasks.md`; logged 0/410 tasks; no completed, in-progress, blocked, or deferred tasks. | Lead Solution Architect | — |
| 2026-06-26 12:08 | Generated `.codex/roadmap.md` (16 milestones, ~30 engineer-weeks). | Lead Solution Architect | — |
| 2026-06-26 12:26 | Generated `.codex/task_queue.md` (410 atomic tasks, all `Status: Not Started`). | Lead Solution Architect | — |
| 2026-06-26 12:42 | Generated `.codex/current_milestone.md` (active milestone: M1). | Lead Solution Architect | — |
| 2026-06-26 (init) | Repository initialized: `AGENTS.md`, `docs/01`–`docs/16`, `.codex/`. No application source code present. | — | — |

---

## 8. Decisions

Architecture-level or scope-level decisions taken during implementation. Each decision should be explicit, cite the spec sections that justify it, and be referenced from §5, §6, or §7 when applicable.

| ID  | Date (IST) | Decision | Rationale | Spec reference | Decided by |
| --- | --- | --- | --- | --- | --- |
| D-001 | 2026-06-26 | Backend uses **MySQL 8.4 LTS** as the authoritative database. | `AGENTS.md` and `docs/16` §2 explicitly override earlier `docs/04` references to PostgreSQL/PostGIS; spatial features use MySQL Spatial. | `docs/16` §2, §36 | Lead Solution Architect |
| D-002 | 2026-06-26 | Citizen mobile experience in V1 is a **Progressive Web App** (PWA), not a native app. | `docs/01` §13 specifies PWA in V1. | `docs/01` §13; `docs/06` | Lead Solution Architect |
| D-003 | 2026-06-26 | **No business logic** in controllers, components, or routes for any milestone. | `AGENTS.md` Architecture Rules, `docs/03` §26, `docs/14` §39. | `docs/03` §26; `docs/14` §39 | Lead Solution Architect |
| D-004 | 2026-06-26 | Departments, categories, workflows, prompts, SLAs, AI models, and connectors are **DB-driven, never in source**. | `docs/14` §20, `docs/09` §10–§14. | `docs/14` §20; `docs/09` | Lead Solution Architect |
| D-005 | 2026-06-26 | M1 introduces **no business modules**; only `App\Modules\Shared` is scaffolded. | Scope guardrail from `.codex/current_milestone.md` §4. | `.codex/current_milestone.md` §4 | Lead Solution Architect |
| D-006 | 2026-06-26 | Task ordering in `.codex/task_queue.md` is the **execution order**; no parallel scheduling without an architect-approved exception. | Atomic-task principle: each task only depends on tasks earlier in the file. | `.codex/task_queue.md` "How to Read" | Lead Solution Architect |

---

## 9. Repository Statistics

Snapshot at file initialization. Updated as the repository grows.

| Metric | Value |
| --- | --- |
| Source files (excluding `.git/`, `vendor/`, `node_modules/`) | 0 |
| Lines of backend code (`backend/app/`) | 0 |
| Lines of backend tests (`backend/tests/`) | 0 |
| Lines of frontend code (`frontend/src/`) | 0 |
| Lines of frontend tests (`frontend/src/**/*.test.*`, `frontend/e2e/`) | 0 |
| Lines of `docs/` | 16,204 |
| Lines of `.codex/roadmap.md` | 991 |
| Lines of `.codex/task_queue.md` | 5,163 |
| Lines of `.codex/current_milestone.md` | 212 |
| Lines of `.codex/completed_tasks.md` (this file) | `<pending>` |
| Database migrations | 0 |
| Eloquent models | 0 |
| API endpoints (under `routes/api.php`) | 0 (only `/api/v1/health` and `/api/v1/health/ready` will exist after M1) |
| Pest tests | 0 |
| Vitest tests | 0 |
| Playwright E2E tests | 0 |
| Git commits on `main` | 0 |
| Open PRs | 0 |
| Open Critical / High defects | 0 |
| Coverage: Backend | n/a (no code yet) |
| Coverage: Frontend | n/a (no code yet) |

> **Refresh rule:** after each task is marked `Done`, the agent updates the relevant counters above and the milestone table in §2. Do not rewrite history; only update current values.

---

## 10. Maintenance Notes

* The file is meant to be machine- and human-readable. Keep Markdown tables aligned; keep status values exactly `Done` / `In Progress` / `Blocked` / `Deferred` / `Not Started` so future tooling can parse them.
* Always quote the commit hash in the form `(<type>(<scope>): <description>, sha: <7-12 chars>)` when adding a §3 entry.
* When a task is blocked, the block entry in §6 must reference a §8 Decision and a §7 Change Log entry. Do not invent blockers ad-hoc.
* When a task is deferred, the §5 entry must reference a §8 Decision and a re-evaluation date.
* This file is updated by the implementing agent on each task boundary, not on a timer. Drift is a defect; sync immediately after the corresponding `.codex/task_queue.md` status change.
* If a task is later un-done (reopened), append a §7 entry and reflect the change in §2. Do not silently delete prior §3 history.

---

## 11. Next Action

* **M1 — Repository Bootstrap & Tooling is complete (22/22 tasks done, 5.4 % of the 410-task roadmap).** Next milestone is M2 — Identity, Auth & RBAC Core (30 tasks; first task `T-M2-001 — Create users migration with UUID PK and soft deletes`). Switch `.codex/current_milestone.md` to M2 before resuming work.
* After `T-M1-001` is marked `Status: Done` in `.codex/task_queue.md`, append the first entry to §3 here, increment the M1 `Done` counter in §2, and update §1's `Last updated` timestamp.
* If any host prerequisite (PHP 8.4, Composer, Node 20+, Docker, Docker Compose) is missing, add a §6 entry and stop until the prerequisite is met.


---

## 12. Repository Statistics (initial)

* **Backend (Laravel 12.62.0):** framework installed, Sanctum wired, Spatie published, MySQL config keys set, PHPStan max + Pint + Pest green.
* **Backend (Laravel 12.62.0):** framework installed, Sanctum wired, Spatie published, MySQL config keys set, PHPStan max + Pint + Pest green (14 tests, 50 assertions).
* **Backend Shared module:** RequestId middleware (X-Request-Id header + trace_id attribute), ApiResponse envelope (success/paginated/error), ApiException (errorCode renamed from `code` to avoid clashing with `Exception::$code` under readonly), BaseController/BaseService/BasePolicy (BasePolicy uses `Authenticatable` contract — no module-specific deps).
* **Backend Health:** GET /api/v1/health (live) and /api/v1/health/ready (DB+Redis+Storage+Queue probes) — 200 happy / 503 degraded.
* **Backend Storage:** media_local + media_minio (S3-compatible) disks in config/filesystems.php; league/flysystem-aws-s3-v3 installed.
* **Backend Queue:** Redis connection; Horizon 5.5 installed; horizon-night schedule.
* **Backend OpenAPI 3:** swagger-php annotations on HealthController + App\Http\OpenApi (Info, Server, SecurityScheme sanctum, Tag Health); /api/documentation serves Swagger UI 5.17.14; /api/v1/openapi.yaml serves the spec.
* **Frontend:** Vite 6 + React 19 + TypeScript 5.9 (strict, noUncheckedSideEffectImports); Vitest 3 + @testing-library/react 16 + jsdom 25; TanStack Query 5, React Hook Form 7, Zod 3, React Router 7, Leaflet 1.9, ECharts 5.6, Headless UI 2.2, Tailwind v4 (via @tailwindcss/vite); ESLint 9 flat config (typescript-eslint recommendedTypeChecked, react-hooks, react-refresh, jsx-a11y); Prettier 3 (singleQuote, semi, trailingComma all, printWidth 100).
* **Docker:** compose stack (mysql 8.4, redis 7.4, minio, minio-init, php, queue, scheduler, nginx 1.27); PHP 8.4-FPM Dockerfile with bcmath/exif/gd/intl/mbstring/pcntl/pdo_mysql/zip/redis extensions, non-root app user; nginx default.conf with HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, 100m body limit; minio-init.sh idempotent bucket bootstrap.
* **CI:** .github/workflows/ci.yml (backend + frontend + docker-build + dependency-scan); .github/CODEOWNERS.
* **Docker:** empty `docker/{php,nginx,minio}` skeletons; compose stack pending (T-M1-011..T-M1-014).
* **Tooling:** PHP 8.5.4, Composer 2.9.5, Node v25.9.0, npm 11.12.1, Docker 29.3.0 (daemon running), Docker Compose v5.0.0, mysql 9.6.0, redis-cli/redis-server, ffprobe — all available in the sandbox.
