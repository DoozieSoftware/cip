# CIP — Technical Audit Report

**Repository:** DoozieSoftware/cip · **Branch:** main · **Audit date:** 2026-07-16
**Auditor:** Automated technical audit (read-only)
**Scope:** Full-stack audit of backend, frontend, security, data, AI, tests, CI, deployment, and documentation. **Audit only — no application code was changed, no DB/storage was mutated, no secrets were read or exposed.**

---

## 1. Executive Summary

CIP is a genuinely substantial, well-architected civic-reporting platform. The end-user surfaces claimed complete (M1–M13 + M17) are real: 15 Laravel domain modules, 166 registered `api/v1` routes, 5 React portals, an offline-capable citizen PWA, a working AI vision pipeline with duplicate/fraud/routing stages, and ~225 backend test files plus 145 passing frontend unit tests. The module boundaries, service/repository/policy layering, and audit/rate-limit discipline described in `AGENTS.md` are followed with real rigor across the codebase.

However, the platform is **not production-ready**, and the `.codex` tracking materially overstates readiness. Three findings are launch-blocking:

1. **`CIP_DEBUG_OTP=true` is shipped in the production env template** (`backend/.env.cpanel`) and is *force-overwritten on every deploy*, so `POST /auth/send-otp` returns the OTP in its own response in production. Combined with a pilot migration that raised the OTP cap to 1000/hour, this is a direct account-takeover path.
2. **The entire production-hardening third of the roadmap (M14 connectors, M15 security hardening, M16 observability/release) is unbuilt** — 0/66 tasks — yet the platform auto-deploys to production on every push to `main` with **no test gate and no manual approval**.
3. **An internal AI endpoint is missing its authorization check** (`InternalAiController`), letting any authenticated user drive the AI pipeline and read AI results for any report.

The `.codex` files describe the remediation work as "uncommitted at time of writing" and cite test counts (79/87/109) that no longer match reality (145 frontend). The documentation-vs-code drift that a prior 2026-07-01 red-team audit flagged has partially recurred.

**Bottom line:** M1–M13 + M17 are real and demo-grade. A controlled pilot is feasible *after* the critical OTP fix. A public production launch is not — the connector, security-hardening, and observability milestones that the roadmap itself designates as the production gate do not exist.

---

## 2. Overall Score

### **62 / 100**

| Dimension | Weight | Score | Notes |
| --- | --- | --- | --- |
| Architecture & code quality | 20 | 16/20 | Clean modular Laravel; strict types, policies, DTOs, events. Repo-wide Pint + full PHPStan currently broken. |
| Feature completeness (in-scope M1–M13, M17) | 20 | 17/20 | Surfaces are real and cohesive. |
| Security & privacy | 20 | 7/20 | Debug-OTP in prod, missing authz on an internal endpoint, no CSP, non-blocking dependency scans. |
| Production readiness (M14–M16) | 15 | 2/15 | Connectors, hardening, observability, backups, runbooks essentially absent. |
| Testing & CI | 15 | 10/15 | Good test volume; CI only checks *changed* files; prod deploy runs no tests. |
| Documentation accuracy | 10 | 5/10 | Strong module docs; tracking overstates status; several concrete mismatches. |
| **Total** | **100** | **62** | |

---

## 3. Production-Readiness Verdict

> ## 🔴 NO-GO for public production launch.
> ## 🟡 CONDITIONAL-GO for a controlled pilot — only after Critical #1 (debug OTP) is fixed.

The roadmap defines M16 ("does not introduce new features; it hardens and certifies what is already in place") as the release gate, and M14/M15 as prerequisites. None of the three have started. Independent of that, two shipped configuration/authorization defects are exploitable today.

---

## 4. Verified Milestone Status

Legend: **Verified** = code, routes, and tests observed on disk. **Overstated** = tracked 100% but material gaps vs. its own Definition of Done. Backend test *execution* could not be independently verified in the audit environment (no `pdo_sqlite`; see §8).

| ID | Title | `.codex` claim | Audit finding | Verdict |
| --- | --- | --- | --- | --- |
| M1 | Bootstrap & Tooling | 100% | Docker stack, health endpoints, CI, OpenAPI all present | ✅ Verified |
| M2 | Auth & RBAC | 100% | OTP + staff password login, Sanctum, refresh rotation, Spatie roles, audit | ✅ Verified |
| M3 | Master Config & Geography | 100% | Geography, departments, settings, feature flags, CRUD | ✅ Verified |
| M4 | Reports Domain | 100% | Submission, idempotency, timeline, citizen read APIs | ✅ Verified |
| M5 | Media & Evidence | 100% | Upload gates, hashing, chain-of-custody, signed URLs, ClamAV/Null scanners | ✅ Verified |
| M6 | Workflow Engine | 100% | DB-driven state machine, SLA job, cache invalidation | ✅ Verified |
| M7 | Routing Engine | 100% | Rule DSL, priority eval, reassignment | ✅ Verified |
| M8 | AI Vision Pipeline | 100% | Orchestrator, Qwen/OpenAI providers, PII masking, dup/fraud | ⚠️ Verified w/ gaps (no `MockProvider`, OCR not wired) |
| M9 | Notifications | 100% | Dispatcher, channels, templates, listeners | ✅ Verified |
| M10 | Moderator Portal | 100% | Backend + React portal, queue/review/merge/reject | ✅ Verified |
| M11 | Operations Portal | 100% | Backend + React portal, lifecycle, exports, notes | ✅ Verified |
| M12 | Super Admin Portal | 100% | Full admin CRUD surface + React portal | ✅ Verified |
| M13 | Citizen PWA | 100% | SPA, offline queue, SW, push, guardrails | ✅ Verified |
| M17 | Public Transparency Portal | 100% | 3 unauthenticated endpoints + portal | ✅ Verified |
| **M14** | **External Connectors** | **0%** | Only an `Integration` config model + admin CRUD. No `ConnectorManager`, `ConnectorInterface`, REST/SOAP/Webhook adapters, retry, DLQ, health monitor, or mock connectors | ❌ Not started (confirmed) |
| **M15** | **Security & Anti-Fraud Hardening** | **0%** | No risk engine, ban/appeal, encrypted-PII columns, CSP, ZAP, or blocking dependency/container scans. Pieces of rate-limiting/audit exist from earlier milestones | ❌ Not started (confirmed) |
| **M16** | **Production Hardening & Release** | **0%** | No Prometheus metrics, error tracking, k8s health trio, backup jobs, load tests, staging workflow, or runbooks beyond deploy | ❌ Not started (confirmed) |

**Verified completion:** In-scope end-user milestones (M1–M13, M17) are substantially real. Roadmap task-count completion of **354/420 ≈ 84.3%** is broadly accurate as a *task count*, but readiness-weighted it is lower because the unbuilt 16% is the entire production-hardening/security/connector layer that gates launch. Independent verification is partial: backend tests could not be executed here (see §8).

---

## 5. Findings by Severity

### 🔴 Critical

**C-1 — Debug OTP leakage enabled in production, and re-forced on every deploy**
*Security / Privacy · M2 · M15/M16*
- **Evidence:** `backend/.env.cpanel` → `CIP_DEBUG_OTP=true` (with `APP_ENV=production`). `backend/app/Modules/Authentication/Http/Controllers/AuthController.php:62-63` returns `debug_otp` in the response when `config('cip.auth.debug_otp')` is true. `.github/workflows/deploy-production.yml:154` force-overwrites `CIP_DEBUG_OTP` from `.env.cpanel` on every deploy, so a manual server fix is reverted next deploy.
- **Aggravating:** `backend/database/migrations/2026_07_09_130000_raise_otp_rate_limit_for_pilot.php` raises the OTP cap to **1000/hour** (its own TODO says "revert to 5 before go-live"). `CIP_DEMO_MODE=true` is also set in prod.
- **Impact:** Anyone who knows a mobile number can request an OTP and read it straight from the API response, then verify and obtain access + refresh tokens — full account takeover for citizens and any OTP-capable account. This is exploitable in the current production configuration.
- **Fix:** Set `CIP_DEBUG_OTP=false` in `.env.cpanel`; remove it from `FORCE_UPDATE_KEYS`; revert the OTP-cap migration (add a new migration setting `per_hour=5`); set `CIP_DEMO_MODE=false`. Add a deploy guard that fails if `APP_ENV=production` and any debug/demo flag is true.
- **Effort:** 0.5 day.

### 🟠 High

**H-1 — Internal AI endpoints lack authorization**
*Security (Broken Access Control) · M8 · OWASP A01*
- **Evidence:** `backend/app/Modules/AI/Http/Controllers/Internal/InternalAiController.php` — `process()`, `job()`, `result()` contain no role check; the docblock claims "the `system` Spatie role is required" but nothing enforces it. Routes (`backend/routes/api.php:250-257`) are gated only by `auth:sanctum` + `throttle:admin`.
- **Impact:** Any authenticated user (including a `citizen`) can enqueue AI pipeline runs for arbitrary report IDs and read AI job status/results (labels, fraud/duplicate scores) for any report — a queue-abuse and information-disclosure vector.
- **Fix:** Add a `system`-role gate (Form Request `authorize()` or middleware) to all three methods; or, per the docblock's stated intent, restrict the route group to internal mTLS in production.
- **Effort:** 0.5 day.

**H-2 — Production deploy has no test gate and no approval**
*DevOps / Release · M16*
- **Evidence:** `.github/workflows/deploy-production.yml` triggers on `push: branches:[main]` for `backend/**`, `frontend/**`, `deploy/**`. It builds and rsyncs to cPanel and runs `migrate --force`, but runs **no** Pint/PHPStan/Pest/Vitest and has **no** `environment:` approval gate. `.github/workflows/ci.yml` only lints/analyses/tests **changed** files and is a separate workflow (not a required upstream of deploy).
- **Impact:** A single push to `main` deploys straight to production with no automated verification and no human approval — directly contradicting M16's DoD ("manual approval gates", "deploy to production on tagged releases") and `AGENTS.md` change-control intent.
- **Fix:** Require the CI workflow to pass before deploy (`workflow_run` or a single gated pipeline); add a GitHub `environment` with required reviewers; switch the trigger to tags/releases.
- **Effort:** 1 day.

**H-3 — Repo-wide static analysis and formatting are broken on `main`**
*Code quality / CI · M1/M16*
- **Evidence:** `vendor/bin/phpstan analyse --no-progress` (full app) aborts with a fatal: *"Internal error: Class `App\Modules\Users\Models\Department` was not found"* discovering symbols from `UserResource.php` — Larastan cannot resolve the FQCN pattern (`User.php:159` references `\App\Modules\Departments\Models\Department`). `vendor/bin/pint --test` reports **~150 files** needing formatting. Because CI only checks *changed* files, these never surface in the pipeline.
- **Impact:** The advertised quality gates (`phpstan --level=max`, Pint) do not actually run clean across the repo; regressions can accumulate invisibly. Full-tree PHPStan is unusable.
- **Fix:** Resolve the Larastan discovery error (verify autoload/paths, or the offending resource import); run `vendor/bin/pint` across the repo; add a periodic full-tree lint/analyse job.
- **Effort:** 1–2 days.

### 🟡 Medium

**M-1 — No Content-Security-Policy; dependency/container scans are non-blocking**
*Security · M15*
- **Evidence:** `docker/nginx/default.conf:22-27` and `deploy/public_html/.htaccess:46-53` set HSTS/X-Frame/X-Content-Type/Referrer/Permissions but **no CSP**. Production `.htaccess` also omits HSTS. `ci.yml:251-267` runs `composer audit` and `npm audit` with `|| true` (never fails the build); no Trivy/container or OWASP ZAP scan exists despite M15's DoD.
- **Impact:** Reduced XSS defense-in-depth; known-vulnerable dependencies can ship silently.
- **Fix:** Add a CSP (start report-only), add HSTS to prod `.htaccess`, make `composer audit`/`npm audit` blocking at `--audit-level=high`, add Trivy.
- **Effort:** 1–2 days.

**M-2 — M14 "Integrations" is a config shell, not a connector framework**
*Architecture / Feature · M14*
- **Evidence:** `app/Modules/Integrations/` contains only `Integration` model, `IntegrationRepository`, `IntegrationAdminService`, and admin CRUD. No `ConnectorManager`, `ConnectorInterface`, REST/SOAP/Webhook adapters, retry/DLQ, field-mapping DSL, health monitor, or seeded mock connectors (all specified in `.codex/task_queue.md` T-M14-001..024).
- **Impact:** The M12 admin "Integrations" screen manages rows that nothing consumes; no report can actually reach an external department/SMS/GIS system. Outbound integration is non-functional.
- **Fix:** Implement M14 per plan (see IMPLEMENTATION_PLAN.md §M14).
- **Effort:** ~2 weeks.

**M-3 — Frontend lint fails repo-wide (45 errors, 10 warnings)**
*Code quality · M13*
- **Evidence:** `npm run lint` → 45 errors (mostly `@typescript-eslint/no-unnecessary-type-assertion` in `src/portals/citizen/security/mockGps.ts`, `operations/api/operations.ts`, an unsafe `any` destructure in `ExportMenu.test.tsx`) + unused eslint-disable directives. CI lints only changed files, so `main` stays "green".
- **Impact:** Latent quality debt; the "ESLint clean" DoD is not met repo-wide.
- **Fix:** `npm run lint -- --fix` covers most; hand-fix the unsafe destructure. Add a periodic full-tree lint job.
- **Effort:** 0.5 day.

**M-4 — No observability, backups, or runbooks (M16)**
*Operations · M16*
- **Evidence:** No Sentry/error tracking (not in `composer.json`), no Prometheus metrics endpoint, only `/up` + `/api/v1/health/ready` (not the k8s `live/ready/startup` trio in the DoD), no backup job under `app/`, no k6 scripts, and only a deploy/rollback narrative in `docs/DEPLOY_CPANEL.md` — none of the M16 runbooks (AI failover, DLQ drain, ban appeal, incident response).
- **Impact:** No production visibility, no tested restore path, no incident runbooks.
- **Fix:** Implement M16 per plan.
- **Effort:** ~1.5 weeks.

**M-5 — Queue/scheduler on cPanel run once-per-minute via cron, not as daemons**
*Operations · M16*
- **Evidence:** `deploy-production.yml:201-205` installs a `queue:work --stop-when-empty` cron and drains once at deploy; `docs/DEPLOY_CPANEL.md` documents a per-minute cron for both queue and scheduler.
- **Impact:** Up to ~60s added latency before a report is AI-processed/notified; `CheckSlaBreaches` (every 5 min) only fires if `schedule:run` cron is actually installed (the deploy installs only the queue cron — the scheduler cron is manual). SLA timers may silently not run.
- **Fix:** Verify the scheduler cron is present in production; document/monitor it; consider a long-running worker where the host allows.
- **Effort:** 0.5 day.

### 🟢 Low

**L-1 — `MockProvider` referenced in README/roadmap does not exist.** Only `QwenVLProvider` and `OpenAICompatibleProvider` are implemented (`AiProviderFactory.php`). "MockProvider (default for dev/CI)" is inaccurate. — *Doc mismatch, M8.*

**L-2 — MinIO bucket name inconsistency.** README M5 (§"MinIO bucket") calls it `cip-media` and cites `docker/minio/entrypoint.sh`; the actual bucket everywhere (`docker-compose.yml`, `entrypoint.sh`, migrations) is `cip-evidence`. — *Doc mismatch, M5.*

**L-3 — `docs/04-Database-Design.md` still contains PostgreSQL references** (2 occurrences) though the active stack is MySQL 8.4 (acknowledged in `AGENTS.md`). — *Doc mismatch, M1.*

**L-4 — `npm run budget` fails on GNU/Linux** (`Inodes: unbound variable`, `scripts/check_bundle_budget.sh:29`), as `AGENTS.md` itself notes. The build's largest chunk (`AnalyticsPage`, 550 KB / 182 KB gz) exceeds Vite's 500 KB warning. — *Tooling/perf, M13.*

**L-5 — Stale `.codex` tracking.** `current_milestone.md` §11 says remediation is "uncommitted at time of writing," but git history shows it committed and 40+ commits since. Test counts cited (79/87/109) are stale — actual frontend is **145** passing. — *Doc mismatch.*

---

## 6. Security Assessment

**Strengths:** Consistent `auth:sanctum` + named rate-limiters on every route group; standardized 401/403/422/429 error envelopes with `trace_id` (`bootstrap/app.php`); append-only `security_events` and `audit_logs` via `AuditMiddleware`; write-only credential masking in admin resources; signed-URL media serving with the signature as the auth; refresh-token rotation; PII masking before AI provider calls (`PiiMaskingService`); staff password policy enforced from the DB.

**Weaknesses (ranked):**
1. **C-1** debug OTP in prod + 1000/hr cap + demo mode — account takeover.
2. **H-1** unauthenticated-by-role internal AI endpoints.
3. **M-1** no CSP; non-blocking dependency scans; no container/DAST scanning.
4. **Authorization pattern is fragile:** admin routes carry no role middleware; each controller enforces `super_admin` via a private `ensureAdmin()` (read paths) or Form Request `authorize()` (write paths). This works today (spot-checked across ~18 admin controllers) but a single forgotten call = open endpoint — exactly what happened in **H-1**. Recommend a role middleware on the `admin`/`internal` groups as defense-in-depth.
5. **M15 hardening milestone unbuilt:** no behavioural risk engine, ban/suspension/appeal, or encrypted-at-rest PII columns.

---

## 7. AI Pipeline Assessment

**Working:** A real, queued `AiPipelineOrchestrator` (535 LOC) chains image-quality → PII mask → vision (via `ProviderFailoverService`) → duplicate → fraud → persistence → `AiCompleted`, and correctly never writes a terminal state itself — the workflow engine decides. Providers are DB-configured (`ai_provider_configs`) and swappable at runtime through `AiProviderFactory`. Duplicate detection (perceptual-hash hamming + time-decay + embedding, `DuplicateDetector`) and fraud scoring (weighted mock-GPS/replay/synthetic/device/rate signals, `FraudScorer`) are implemented, and the recent commit history shows active real-world tuning (auto-route threshold lowered to 90, six routing-pipeline bug fixes, claim-matching).

**Gaps / risks:**
- **No `MockProvider`** (L-1) — dev/CI relies on the "AI disabled → synthesized unclassified" path or a live endpoint, making deterministic CI harder than documented.
- **OCR is not wired** (`AiPipelineOrchestrator.php:128` passes an empty string), so text-in-image signals are absent despite the pipeline description.
- **H-1** exposes AI job/result data to any authenticated user.
- Heavy recent bug-fixing on routing/fraud/claim-matching suggests the pipeline is still stabilizing; treat AI outputs as advisory (which the architecture correctly enforces — moderators decide).

---

## 8. Testing & CI Assessment

- **Frontend unit tests: 145 passing across 43 files** (Vitest) — independently verified here. Build passes. 12 Playwright specs exist (not run — no browser).
- **Backend: ~225 test files present**, but **could not be executed in the audit environment** — this host lacks `pdo_sqlite` and `phpunit.xml` forces `sqlite :memory:`, so every test errors with *"could not find driver"* (1218 such errors). Per `AGENTS.md` this is an environment limitation, **not** a real test failure; CI supplies MySQL. **The "100% backend passing" claim therefore remains unverified by this audit**, not disproven.
- **CI design gap:** `ci.yml` runs Pint/PHPStan/Vitest/Prettier on **changed files only**, and Pest on **changed test files only**. This keeps `main` green while repo-wide Pint (~150 files), full PHPStan (fatal, H-3), and ESLint (45 errors, M-3) are all broken. The production deploy workflow runs **no tests at all** (H-2).
- **Recommendation:** add a scheduled/nightly full-tree job (Pint, PHPStan, ESLint, full Pest) and gate deploys on CI success.

---

## 9. Deployment & Operations Assessment

- **Docker Compose** (`docker-compose.yml`) is complete and healthchecked: mysql 8.4, redis, minio + init, php, queue, scheduler, nginx. Good log rotation and dependency ordering.
- **Production = cPanel** via `deploy-production.yml` (rsync + `migrate --force`), with a genuine destructive-command guard (blocks `migrate:fresh`/`db:wipe`), APP_KEY preservation, and `.env` merge that keeps server secrets. These are thoughtful.
- **But:** no pre-deploy tests, no approval gate, deploy-on-push (H-2); queue/scheduler run as per-minute cron rather than daemons, and the deploy only installs the **queue** cron — the **scheduler** cron (which drives `CheckSlaBreaches`) is manual and may be missing (M-5); no backups/restore drill, metrics, error tracking, or rollback automation (M-4, M16 unbuilt).
- **Rollback:** `.env.bak` gives config rollback only; there is no code-version rollback or DB restore path.

---

## 10. Documentation Mismatches (consolidated)

| # | Claim | Reality | Sev |
| --- | --- | --- | --- |
| L-1 | README/roadmap: `MockProvider` is the dev/CI default | No `MockProvider` class exists | Low |
| L-2 | README M5: MinIO bucket `cip-media` | Actual bucket is `cip-evidence` everywhere | Low |
| L-3 | `docs/04` PostgreSQL references | Stack is MySQL 8.4 | Low |
| L-5 | `current_milestone.md`: remediation "uncommitted" | Committed; 40+ commits since | Low |
| L-5 | README: `npm test` runs 79; tracking says 87/109 | Actual 145 passing | Low |
| §4 | `.codex`: "100% of in-scope work" complete | M15 hardening is production-scope and unbuilt; "in-scope" framing hides the launch gate | Medium |
| L-1 | Roadmap M8 DoD: "responses validate against docs/10 §14 schema", "benchmark 50-image fixture" | Validator exists; OCR unwired; MockProvider absent | Low |

---

## 11. Final Launch Recommendation

**Do not launch to public production.** The roadmap's own release gate (M14→M15→M16) is entirely unbuilt (0/66), and two configuration/authorization defects (C-1, H-1) are exploitable in the current production setup.

**Recommended path:**
1. **Immediately** fix C-1 (debug OTP + rate cap + demo mode) — this alone makes the *pilot* defensible.
2. Fix H-1 (internal AI authz) and H-2 (deploy gate) before any wider exposure.
3. Then execute M15 (security hardening) and M16 (observability, backups, runbooks, load test) — these are the real launch blockers, ~3.5 weeks combined.
4. M14 (connectors) is required only when live external integrations are in scope; a pilot can run with it stubbed.

A **controlled pilot** (known users, no real external integrations) is reasonable **after step 1**, given how much of M1–M13 is genuinely solid.

---

*Verification commands run: `vendor/bin/pint --test` (fail, ~150 files), `vendor/bin/phpstan analyse --no-progress` (fatal, H-3), `vendor/bin/pest` (env-blocked, no pdo_sqlite), `php artisan route:list --path=api/v1` (166 routes, boots clean), `npm run lint` (45 errors), `npm test --run` (145 pass), `npm run build` (pass), `npm run budget` (env-broken). No DB or storage was mutated; no secrets were read.*
