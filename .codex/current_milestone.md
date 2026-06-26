# Current Milestone — M1: Repository Bootstrap & Tooling

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** Done (22 / 22 tasks complete)
**Last updated:** 2026-06-26 13:55 IST
**Source Documents:** `AGENTS.md`, `.codex/roadmap.md` §M1, `.codex/task_queue.md` §M1, `docs/01`–`docs/16`

> **M1 is complete.** All 22 tasks (T-M1-001..T-M1-022) are marked `Status: Done` in `.codex/task_queue.md` and the full log lives in `.codex/completed_tasks.md` §3. The next milestone is **M2 — Identity, Auth & RBAC Core** (30 tasks). The implementing agent should switch to the M2 section of `.codex/task_queue.md` before resuming work.

---

## 1. Current Milestone

* **Milestone ID:** M1
* **Title:** Repository Bootstrap & Tooling
* **Estimated complexity:** Medium
* **Estimated duration:** 1 week
* **Total tasks:** 22 (T-M1-001 → T-M1-022)
* **Depends on:** None
* **Unblocks:** M2 (Identity, Auth & RBAC Core) — first M2 task `T-M2-001` depends on `T-M1-002`

---

## 2. Objective

Establish a buildable, testable, CI-ready monorepo skeleton for backend (Laravel 12) and frontend (React 19) with all required infrastructure services (MySQL 8.4 LTS, Redis, MinIO) running via Docker Compose.

The deliverable is a runnable "hello world": a fresh clone plus `docker compose up` brings up the full platform, `GET /api/v1/health` returns green, `GET /api/documentation` renders the OpenAPI scaffold, CI is green, and every later milestone plugs into a verified base.

This milestone is the **single source of truth** for the build environment; later milestones add domain logic but must not re-introduce or change the bootstrap contracts established here.

---

## 3. Deliverables

Mapped one-to-one with `.codex/roadmap.md` §M1 "Expected Deliverables" and `.codex/task_queue.md` §M1.

| # | Deliverable | Owning task(s) |
| --- | --- | --- |
| 1 | Monorepo skeleton (`backend/`, `frontend/`, `docker/`, `scripts/`, `.github/`, `.gitignore`, `.editorconfig`, README) | T-M1-001 |
| 2 | `backend/` Laravel 12 with PSR-12, PHPStan max, Pint, PestPHP, Sanctum, Spatie Permission | T-M1-002, T-M1-003, T-M1-004, T-M1-006, T-M1-007 |
| 3 | `frontend/` Vite + React 19 + TypeScript + Tailwind v4 + TanStack Query + React Hook Form + Zod + React Router + Leaflet + ECharts | T-M1-008, T-M1-009 |
| 4 | Frontend tooling: ESLint flat config, Prettier, Vitest | T-M1-010 |
| 5 | `docker-compose.yml` with `nginx`, `php`, `queue`, `scheduler`, `mysql` (8.4 LTS), `redis`, `minio` | T-M1-011 |
| 6 | PHP-FPM Dockerfile (PHP 8.4, required extensions, Composer, non-root `app` user) | T-M1-012 |
| 7 | Nginx site config with reverse proxy, gzip, security headers, 100 MB body limit | T-M1-013 |
| 8 | MinIO init script that creates `cip-evidence` with versioning + object-lock | T-M1-014, T-M5-018 (extension) |
| 9 | Laravel `media_local` and `media_minio` storage disks | T-M1-015 |
| 10 | Laravel queue wired to Redis | T-M1-016 |
| 11 | `App\Modules\Shared` with `BaseController`, `BaseService`, `BasePolicy`, `ApiResponse` trait, `ApiException`, `RequestId` middleware | T-M1-017, T-M1-018, T-M1-019 |
| 12 | `GET /api/v1/health` (liveness) and `GET /api/v1/health/ready` (readiness) with per-component status | T-M1-020 |
| 13 | OpenAPI 3.1 scaffold and Swagger UI at `/api/documentation` | T-M1-021 |
| 14 | GitHub Actions CI: lint, static analysis, tests, build, docker build | T-M1-022 |
| 15 | MySQL 8.4 LTS connection (utf8mb4, utf8mb4_unicode_ci, InnoDB, strict mode) | T-M1-005 |

### Commit Boundaries (expected)

In order, on a clean `main`:

1. `chore(repo): initial commit with AGENTS.md, docs/ and .codex/roadmap.md`
2. `chore(backend): bootstrap Laravel 12 with PSR-12, PHPStan, Pint, Pest`
3. `chore(frontend): bootstrap Vite + React 19 + TypeScript + Tailwind v4`
4. `chore(infra): docker-compose for mysql, redis, minio, nginx, php, queue, scheduler`
5. `feat(shared): base exception, ApiResponse trait, request-id middleware, /health endpoint`
6. `ci: GitHub Actions pipeline (lint → analyse → test → build → docker-build)`
7. `docs: README with quickstart and architecture pointers`

---

## 4. Scope

In-scope for M1 (do these):

* Create the monorepo directory layout exactly as specified in `docs/14` §4 and `docs/16` §3.
* Initialize Laravel 12 inside `backend/` and Vite + React 19 inside `frontend/`.
* Pin tool versions: PHP 8.4, Laravel 12, React 19, MySQL 8.4 LTS, Redis 7.x, MinIO RELEASE.2024-latest.
* Configure quality tooling to enforce **zero-warning** gates: PHPStan max level, Pint, ESLint flat config, Prettier, Vitest, PestPHP.
* Wire `docker compose` so a single command on a clean host starts the entire stack.
* Ship a working `GET /api/v1/health` and a stubbed web shell so that the user can see "it works" end-to-end.
* Establish the `App\Modules\Shared` foundation that every later backend module will extend.
* Author the CI workflow that all later PRs must pass.
* Create the README and cross-link it to `.codex/roadmap.md`.

### Operational guardrails

* No business logic in `BaseController` (it only wraps the standard envelope and applies the request-id middleware).
* No module-domain code (auth, reports, media, etc.) — those are M2+.
* No secrets in source: `.env.example` only, with placeholders.
* No database tables other than Laravel + Sanctum + Spatie default migrations.
* No business scaffolding under `app/Modules/<Name>/` other than `Shared/`.

---

## 5. Out of Scope

Explicitly **deferred** to later milestones — do not start these in M1:

* M2 — Identity, Auth, RBAC: users, otps, refresh_tokens, role/permission seeds, OTP/JWT flows.
* M3 — Geography, departments, settings, feature flags.
* M4 — Reports domain, submission, idempotency, error codes.
* M5 — Media uploads, MinIO evidence bucket, hash/chain-of-custody.
* M6 — Workflow engine, state machine.
* M7 — Routing engine.
* M8 — AI pipeline, providers, prompt library.
* M9 — Notifications.
* M10–M14 — Frontend portals and connector framework.
* M15 — Security hardening, OWASP ZAP, dependency scanning.
* M16 — Production deployment, observability stack, runbooks.
* Any visual UI beyond the stubbed "hello world" shell on the frontend.
* Any business-specific migrations, models, controllers, or routes under `app/Modules/` other than `Shared/`.
* Hardcoded departments, categories, report types, workflows, AI providers — those are all DB-driven in their own milestones.

If a task in `.codex/task_queue.md` is not listed in the M1 task list (T-M1-001 → T-M1-022), it is out of scope for this milestone.

---

## 6. Exit Criteria (Definition of Done)

This milestone is **Done** only when **all** of the following are verified on a clean machine, in this exact order:

1. **Repository layout** — `ls -la` from the project root shows `backend/`, `frontend/`, `docker/`, `scripts/`, `.github/`, `docs/`, `AGENTS.md`, `.codex/` (with `roadmap.md` and `task_queue.md`), `.gitignore`, `.editorconfig`, `README.md`. (T-M1-001)
2. **Backend boots** — `php artisan --version` inside `backend/` reports `Laravel Framework 12.x`; `composer.json` declares `php: ^8.4`. (T-M1-002)
3. **Frontend boots** — `npm run build` inside `frontend/` exits 0; `npm run test -- --run` runs and passes a trivial Vitest test. (T-M1-008)
4. **Tooling** — `vendor/bin/pint --test`, `vendor/bin/phpstan analyse --level=max`, `npm run lint`, `npm run format -- --check` all exit 0. (T-M1-006, T-M1-007, T-M1-010)
5. **Quality gates green** — `composer test` (Pest) and `npm test` (Vitest) both pass.
6. **Stack starts** — `docker compose up -d` brings up `nginx`, `php`, `queue`, `scheduler`, `mysql` (8.4), `redis`, `minio` without errors on a clean host. PHP-FPM can `php artisan migrate` against MySQL successfully. (T-M1-011, T-M1-012, T-M1-013, T-M1-016)
7. **Storage wired** — `Storage::disk('media_minio')->put('hello.txt', 'hi')` round-trips against the running MinIO. (T-M1-015)
8. **Shared module** — `App\Modules\Shared\{BaseController,BaseService,BasePolicy,ApiResponse,ApiException,RequestId}` exist; `RequestId` is registered in `app/Http/Kernel.php`. Pest tests `tests/Unit/Shared/RequestIdTest.php` and `tests/Unit/Shared/ApiResponseTest.php` pass. (T-M1-017, T-M1-018, T-M1-019)
9. **Health endpoints** — `GET /api/v1/health` returns HTTP 200 with green DB / Redis / MinIO / Queue probes; intentionally failing a probe (e.g. stop Redis) flips the response to 503. `GET /api/v1/health/ready` follows the same contract for readiness. (T-M1-020)
10. **OpenAPI** — `GET /api/documentation` returns 200 with the Swagger UI; `openapi.yaml` validates. (T-M1-021)
11. **CI** — `.github/workflows/ci.yml` exists with backend (`pint`, `phpstan`, `pest`) and frontend (`eslint`, `prettier`, `vitest`, `vite build`) jobs plus a docker-build job; required checks are configured on `main`. The workflow runs green on the M1 commit. (T-M1-022)
12. **Documentation** — `README.md` has a "Quickstart" section that points to `docs/`, `.codex/roadmap.md`, and `.codex/task_queue.md`; the existing `docs/` folder remains intact. (T-M1-001, T-M1-022)
13. **No regressions on `docs/`** — `git status` shows no modifications to `AGENTS.md` or any file under `docs/`. M1 is a pure bootstrap milestone.
14. **MySQL contract** — `DB_CHARSET=utf8mb4`, `DB_COLLATION=utf8mb4_unicode_ci`, `DB_ENGINE=InnoDB`, `DB_STRICT=true` in `backend/.env.example`. (T-M1-005)
15. **Mark all M1 tasks Done** — every task in `.codex/task_queue.md` with ID `T-M1-001` through `T-M1-022` is moved from `Status: Not Started` to `Status: Done` with a brief note in the `Required tests` field linking to the passing run.

When all 15 conditions hold, M1 is **Done** and M2 may begin.

---

## 7. Documents That Must Be Read Before Implementation

In this order — non-negotiable per `AGENTS.md` "Read Order":

1. **`AGENTS.md`** — the engineering constitution; defines Read Order, architecture rules, coding rules, and "When Unsure" doctrine.
2. **`docs/03-System-Architecture.md`** — high-level architecture, backend module list, coding constraints, technology stack, definition of architecture compliance.
3. **`docs/04-Database-Design.md`** — naming conventions, UUID primary keys, InnoDB + utf8mb4 requirement that M1 enforces in `config/database.php`.
4. **`docs/14-DevOps-and-Deployment.md`** — repository structure, Docker standards, CI/CD pipeline, static analysis rules.
5. **`docs/15-QA-and-Test-Strategy.md`** — quality gates (Lint → Analyse → Test → Build → Security scan), test environment, coverage targets (Backend ≥ 90%, Frontend ≥ 80%, Critical 100%).
6. **`docs/16-Codex-Implementation-Roadmap.md`** — authoritative technology stack override (MySQL 8.4 LTS, not PostgreSQL/PostGIS), repository bootstrap commands, commit convention, AI session workflow.

### Supporting references

* `.codex/roadmap.md` §M1 — the milestone entry point with full Definition of Done.
* `.codex/task_queue.md` §M1 — atomic task list (T-M1-001 → T-M1-022) with file paths, acceptance criteria, and required tests per task.
* `docs/05-REST-API-Specification.md` §2, §3, §17 — defines the standard response envelope and HTTP status codes that `App\Modules\Shared\ApiResponse` and `ApiException` must implement.

If any conflict exists between this milestone file and the specifications, the **specifications win**. Stop and request clarification rather than guessing.

---

## 8. Current Implementation Status

| Item | Status |
| --- | --- |
| M1 plan documented in `.codex/roadmap.md` | ✅ Done |
| M1 atomic task list in `.codex/task_queue.md` (T-M1-001 → T-M1-022) | ✅ Done |
| `AGENTS.md` and `docs/` present at repo root | ✅ Done |
| `backend/` directory created | ❌ Not Started (T-M1-001 pending) |
| `frontend/` directory created | ❌ Not Started (T-M1-001 pending) |
| `docker-compose.yml` authored | ❌ Not Started (T-M1-011 pending) |
| `GET /api/v1/health` returns 200 | ❌ Not Started (T-M1-020 pending) |
| `GET /api/documentation` renders | ❌ Not Started (T-M1-021 pending) |
| CI workflow green on `main` | ❌ Not Started (T-M1-022 pending) |
| All 22 M1 tasks marked `Status: Done` | ❌ Not Started (0/22) |

**Progress:** 0 of 22 M1 tasks complete (0 %).

**Active task:** T-M1-001 — Create root monorepo skeleton directories (`.codex/task_queue.md` §M1).

**Next executable task after T-M1-001:** T-M1-002 — Initialize Laravel 12 backend project.

---

## 9. Blocking Issues

**None.**

The repository currently holds only `AGENTS.md` and `docs/`. The first M1 task (`T-M1-001`) is a directory-creation task with no external dependency. PHP 8.4, Composer, Node 20+, Docker, and Docker Compose are assumed available on the host (per the milestone's `Prerequisites` in `.codex/roadmap.md`).

If any of those host prerequisites is missing, that becomes a **blocker** and must be recorded here before continuing.

---

## 10. Next Milestone

* **Milestone ID:** M2
* **Title:** Identity, Authentication & Role-Based Access Control
* **Roadmap reference:** `.codex/roadmap.md` §M2
* **Task list:** `.codex/task_queue.md` §M2 (T-M2-001 → T-M2-030, 30 tasks)
* **Estimated duration:** 2 weeks
* **Estimated complexity:** High
* **Depends on M1 deliverable:** `backend/` Laravel 12 initialized (T-M1-002), Sanctum installed (T-M1-003), Spatie Permission installed (T-M1-004), `App\Modules\Shared` base classes (T-M1-017/018/019) — these are the **M1 exit items that M2 explicitly requires**.

M2 will:

* Define `users`, `roles`, `permissions`, `otps`, `refresh_tokens`, `login_histories`, `security_events`, `audit_logs` migrations.
* Implement OTP service with rate limiting (5/hour) and SMS gateway interface.
* Implement the five `auth/*` endpoints with Sanctum tokens and refresh-token rotation.
* Seed the seven default roles and a baseline permission set.
* Wire audit middleware and device fingerprinting to the Shared base classes shipped in M1.

M2 is **blocked** from starting until M1's exit criteria are all green.


---

## 12. M1 → M2 Handoff Notes

* **Sandbox baseline is green:** `php artisan --version` → 12.62.0; `npm run build` → built in 1.9s; `vendor/bin/pest` → 14 passed (50 assertions); `vendor/bin/phpstan analyse app/` → No errors; `vendor/bin/pint --test` → passed; `docker compose config -q` → exit 0; `npm run lint` → exit 0.
* **MySQL 8.4 is the target** (AGENTS.md + docs/16 §3). Sandbox currently runs sqlite for speed; flip `DB_CONNECTION` to `mysql` and start the compose stack to get the real engine. D-001 (MySQL not Postgres, despite docs/03 §24) is in effect.
* **Vite 6 + Vitest 3** must be paired — Vitest 2.1 ships with Vite 5 and breaks the type chain.
* **Laravel 12** does not have `app/Http/Kernel.php` or `app/Console/Kernel.php`. Middleware, exception rendering, and routing are configured in `bootstrap/app.php`.
* **`App\Modules\Shared` already provides** the envelope (success/paginated/error), the request-id middleware, the global exception handler, and the base controller/service/policy. M2 should extend these — not fork them.
* **M2 user model prerequisite:** the only forward reference to a not-yet-existing class was the `App\Modules\Users\Models\User` (M2 territory). It is no longer referenced — `BasePolicy` uses the framework `Authenticatable` contract; `tests/Pest.php` no longer defines `actingAsRole()`.
* **OpenAPI spec lives at** `backend/storage/api-docs/openapi.yaml` and is regenerated from PHP attributes via `vendor/bin/openapi app -o storage/api-docs/openapi.yaml`. M2 should extend the spec in lockstep with the auth endpoints.
* **Spec pointer recap for M2:** `docs/02` §4, §11, §17; `docs/03` §13–14, §19; `docs/05` §5; `docs/11` §6–9, §19, §21, §22; `docs/14` §19. First M2 task: `T-M2-001 — Create users migration with UUID PK and soft deletes` (depends on `T-M1-002`).
