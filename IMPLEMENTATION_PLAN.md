# CIP — Implementation Plan (Post-Audit)

**Companion to:** `AUDIT_REPORT.md` · **Date:** 2026-07-16 · **Branch:** main

This plan sequences the work needed to reach production readiness. Priorities: **P0** (before any exposure), **P1** (before public launch), **P2** (feature/scope-dependent). Effort is in engineer-days unless noted. Dependencies reference finding IDs (C-1, H-1…) and milestone IDs from `.codex/roadmap.md`.

---

## 0. Immediate Critical Fixes (P0 — do first, ~2–3 days total)

These are shipped defects, independent of the M14–M16 milestones. Do them before any pilot.

### CF-1 — Disable debug OTP and demo mode in production (fixes C-1)
- **Priority:** P0 · **Depends on:** none · **Effort:** 0.5d
- **Steps:**
  1. `backend/.env.cpanel`: `CIP_DEBUG_OTP=false`, `CIP_DEMO_MODE=false`.
  2. `.github/workflows/deploy-production.yml:154`: remove `CIP_DEBUG_OTP` from the `FORCE_UPDATE_KEYS` loop.
  3. New migration reverting `ratelimit.otp_per_hour` to `5` (do **not** edit `2026_07_09_130000…`; add `2026_07_xx_revert_otp_rate_limit.php`).
  4. Add a deploy pre-flight step: fail if `APP_ENV=production` and any of `CIP_DEBUG_OTP`/`CIP_DEMO_MODE` is truthy.
- **Tests:** Feature test asserting `POST /auth/send-otp` response contains **no** `debug_otp` key when `cip.auth.debug_otp=false`; assert OTP throttle returns 429 at the 6th request/hour.
- **Acceptance:** No OTP value in any `send-otp` response in a production-config run; OTP cap = 5/hr; deploy guard blocks a debug-on production deploy.

### CF-2 — Enforce `system` role on internal AI endpoints (fixes H-1)
- **Priority:** P0 · **Depends on:** none · **Effort:** 0.5d
- **Steps:** Add role enforcement to `InternalAiController::process/job/result` — a Form Request `authorize()` (`hasRole('system')`) or a `role:system` middleware on the `internal/ai` route group. Keep the production-mTLS note accurate.
- **Tests:** Feature tests — `citizen`/`moderator` bearer → 403; `system` → 202/200; unauthenticated → 401.
- **Acceptance:** All three internal AI endpoints reject non-`system` authenticated users.

### CF-3 — Gate production deploy on CI + manual approval (fixes H-2)
- **Priority:** P0 · **Depends on:** CI green baseline (see TD-1) · **Effort:** 1d
- **Steps:** Add a GitHub `environment: production` with required reviewers; require the `CI` workflow to succeed (`workflow_run` trigger or a single pipeline with a gated deploy job); move the deploy trigger to tags/releases per M16 DoD.
- **Tests:** Dry-run: a push with a failing unit test must not deploy; deploy requires reviewer approval.
- **Acceptance:** No path from `git push` to production without passing CI **and** a human approval.

### CF-4 — Add defense-in-depth admin role middleware (hardens H-1 class)
- **Priority:** P1 · **Depends on:** none · **Effort:** 0.5d
- **Steps:** Apply a `role:super_admin` middleware to the `/admin` route group (keeping per-controller `ensureAdmin` as belt-and-braces), and `role:system` to `/internal`. Verify moderator/department bypasses still resolve.
- **Acceptance:** Removing a controller's `ensureAdmin()` no longer opens the endpoint.

---

## 1. Technical-Debt & Documentation Fixes (P1, parallelizable, ~3–4 days)

### TD-1 — Restore repo-wide quality gates (fixes H-3, M-3)
- **Effort:** 1.5d · **Steps:** Fix the Larastan discovery fatal (verify autoload/namespaces for `UserResource`→`Department` FQCN; run `phpstan analyse` full-tree to zero). Run `vendor/bin/pint` across the repo. `npm run lint -- --fix` + hand-fix the unsafe `any` destructure in `ExportMenu.test.tsx`. Add a **nightly full-tree** CI job (Pint, PHPStan max, ESLint, full Pest against MySQL).
- **Acceptance:** `pint --test`, `phpstan analyse`, `npm run lint` all exit 0 on the whole tree; nightly job green.

### TD-2 — Fix bundle-budget script + analytics chunk (fixes L-4)
- **Effort:** 0.5d · **Steps:** Make `scripts/check_bundle_budget.sh` GNU-`stat` compatible (guard the `Inodes` unbound var); code-split `AnalyticsPage`/ECharts via dynamic import to drop the 550 KB chunk.
- **Acceptance:** `npm run budget` runs on Linux; no chunk >500 KB or budget threshold documented and enforced.

### TD-3 — Documentation reconciliation (fixes L-1, L-2, L-3, L-5, §4 framing)
- **Effort:** 1d · **Steps:** README: correct bucket to `cip-evidence`, remove `MockProvider` claim (or implement it — see M8-add below), update test counts to live numbers. `docs/04`: replace PostgreSQL references with MySQL. `.codex/current_milestone.md`/`completed_tasks.md`: mark remediation committed; reframe "100% of in-scope" to explicitly state M15/M16 are the production gate.
- **Acceptance:** No documented artifact/count contradicts the code.

### TD-4 — Add a `MockProvider` for deterministic dev/CI (closes L-1 properly)
- **Effort:** 0.5d · **Steps:** Implement `MockProvider implements AIProviderInterface` returning a fixed schema-valid response; register `driver=mock` in `AiProviderFactory`; seed it as the default provider in non-prod.
- **Acceptance:** AI pipeline tests run without a live endpoint; CI deterministic.

---

## 2. M14 — External Connector Framework (P2, ~2 weeks)

**Goal:** turn the M12 "Integrations" config shell into a functioning outbound framework. **Depends on:** M4, M6 (present). Not a public-launch blocker unless live external integrations are in scope; a pilot can stub it.

| Task | Description | Tests | Effort |
| --- | --- | --- | --- |
| 14-A | Migrations: `integration_requests`, `integration_dead_letters` (the `integrations` table exists) | migration round-trip | 0.5d |
| 14-B | `ConnectorInterface` + `ConnectorManager` (singleton, resolves connector by row) | unit | 1d |
| 14-C | `RestConnector`, `WebhookConnector`, `SoapConnector` | contract tests per adapter | 2d |
| 14-D | Auth strategies: None/ApiKey/Bearer/OAuth2 (client-cred + auth-code)/Basic/CustomHeader | unit per strategy | 1.5d |
| 14-E | `FieldMappingEngine` DSL (rename/concat/split/static/conditional) | unit | 1d |
| 14-F | `RetryStrategy` (1/5/15/60 min, max 5) + `DeadLetterService` | feature: retry→DLQ capture | 1.5d |
| 14-G | Idempotency-Key on every outbound request | feature | 0.5d |
| 14-H | `RunConnectorJob` (queued) + connector events | feature | 1d |
| 14-I | Health endpoint `/admin/integrations/{id}/health` + dashboard aggregation | feature | 1d |
| 14-J | PII masking on connector payloads (reuse `PiiMaskingService`) | feature: no mobile/email outbound | 0.5d |
| 14-K | Seed mock Challan/Municipality/Notification/GIS connectors | seeder test | 0.5d |
| 14-L | Static-analysis rule forbidding direct `Http::`/curl in business modules | CI rule | 0.5d |
| 14-M | OpenAPI + `docs/integrations.md` | — | 0.5d |

- **Acceptance (per roadmap M14 DoD):** business modules never call external APIs directly (enforced by 14-L); a connector is addable by super-admin with no code change; failures retry then land in DLQ with full request/response; every outbound request carries an Idempotency-Key; coverage ≥90% on the module.

---

## 3. M15 — Security, Anti-Fraud & Compliance Hardening (P1, ~2 weeks) — LAUNCH BLOCKER

**Goal:** the security posture the roadmap gates launch on. **Depends on:** M2, M4, M5, M8 (present); CF-1..CF-4 done first.

| Task | Description | Tests | Effort |
| --- | --- | --- | --- |
| 15-A | Move rate limits into `settings`/security-policies (already partly DB-driven); document the full `docs/11 §21` matrix | feature | 1d |
| 15-B | Behavioural risk engine: reports/hour, failed logins, mock-GPS, replay → 0–100 score with thresholds (feed from `security_events`) | unit + feature | 2d |
| 15-C | Risk-based auto-actions (flag/queue/throttle) | feature | 1d |
| 15-D | Ban / suspension / appeal workflow with audit, expiry, restoration | feature | 2d |
| 15-E | Security headers: add **CSP** (report-only → enforce) to nginx + prod `.htaccess`; add **HSTS** to prod `.htaccess`; COOP | integration | 1d |
| 15-F | CORS config file (currently none) + CSRF posture doc for Sanctum | feature | 0.5d |
| 15-G | Encrypted-at-rest PII columns (Eloquent cast) for sensitive fields | feature: value encrypted in DB | 1d |
| 15-H | Make `composer audit`/`npm audit` **blocking** (`--audit-level=high`); add Trivy container scan; add OWASP ZAP baseline in CI | CI green | 1.5d |
| 15-I | OWASP Top-10 regression suite + abuse scenarios | feature | 2d |
| 15-J | Security dashboard: failed logins, locked users, rate-limited, fraud trends (partly exists in `SecurityDashboardService`) | feature | 1d |
| 15-K | Secret-rotation runbook + `.env.example` review | — | 0.5d |
| 15-L | `docs/security.md` + OpenAPI for security endpoints | — | 0.5d |

- **Acceptance (per M15 DoD):** `docs/11` controls verifiable by automated tests; dependency/container/DAST scans pass **and gate** CI; security dashboard renders real data; no Critical/High open; 100% coverage on security-critical paths.

---

## 4. M16 — Production Hardening, Observability & Release (P1, ~1.5 weeks) — LAUNCH BLOCKER

**Goal:** make the platform observable, recoverable, and releasable. **Depends on:** all prior + CF-3.

| Task | Description | Tests / Verification | Effort |
| --- | --- | --- | --- |
| 16-A | Structured JSON logging + correlation IDs (RequestId already exists — extend to log context) | feature | 1d |
| 16-B | Prometheus-compatible `/metrics` endpoint | feature | 1d |
| 16-C | Error tracking (Sentry-compatible) wired into the exception handler | manual + feature | 1d |
| 16-D | k8s-style health trio `/health/live`, `/health/ready`, `/health/startup` (extend current `/up` + `/health/ready`) | feature | 0.5d |
| 16-E | Encrypted backup job: daily DB + object storage + weekly config; **restore drill script** and documented test | drill executed on staging | 2d |
| 16-F | Staging deploy workflow (deploy `main`→staging) distinct from prod (tags) | CI | 1d |
| 16-G | Smoke-test pipeline post-deploy (health + key endpoints) | CI | 0.5d |
| 16-H | Verify/repair the **scheduler cron** in production (fixes M-5); document queue/scheduler ops | manual verification | 0.5d |
| 16-I | Runbooks: deploy+rollback, AI failover, connector DLQ drain, ban-appeal, incident response | — | 1.5d |
| 16-J | k6 load test to `docs/02`/`docs/14` targets; staging performance report | load run | 1.5d |
| 16-K | Release-readiness sign-off (`docs/15 §32`) + cutover rehearsal on staging; `RELEASE_NOTES` | — | 1d |

- **Acceptance (per M16 DoD):** deploy succeeds on a clean host via CI with approval; load test meets targets; zero Critical/High open; scans clean **and gating**; backup restore drill succeeds; docs published.

---

## 5. Sequencing, Dependencies & Critical Path

```
P0 (pilot gate):   CF-1 ─┬─ CF-2 ──────────────────► PILOT-SAFE
                         └─ TD-1 ─► CF-3 ─► CF-4

P1 (public gate):  TD-1,TD-2,TD-3,TD-4  ──►  M15 (15-A..L)  ──►  M16 (16-A..K)  ──► PUBLIC LAUNCH
                                              (needs CF-1..4)      (needs M15, CF-3)

P2 (scope-driven): M14 (14-A..M)  — parallel to M15/M16; required only for live external integrations
```

- **Critical path to public launch:** CF-1..CF-4 → TD-1 → M15 → M16 ≈ **~5–6 weeks** with one engineer; ~3 weeks with a squad of three (M14 parallelized).
- **Critical path to a controlled pilot:** **CF-1 alone** makes the pilot defensible; add CF-2/CF-4 same week. ≈ **2–3 days**.
- **Do not** start M14/M15/M16 feature work before CF-1/CF-2 — a debug-OTP production is the single highest-leverage risk.

## 6. Global Acceptance Criteria (definition of "production-ready")

1. No debug/demo flags true in production; OTP cap = 5/hr; deploy guard enforces it.
2. Every `/admin` and `/internal` route enforces its role at the middleware layer.
3. Full-tree Pint, PHPStan (max), ESLint, and Pest all green in a nightly job; deploy gated on CI + manual approval.
4. CSP + HSTS present in production; dependency/container/DAST scans gate CI with zero High/Critical.
5. Observability (logs+metrics+error tracking+health trio) live; backup restore drill passed; runbooks published.
6. Load test meets `docs/02`/`docs/14` targets on staging.
7. `.codex` tracking and README match the code (counts, bucket, providers, stack).
