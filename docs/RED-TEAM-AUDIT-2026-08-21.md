# CIP Pre-Pilot Red Team Audit

**Product:** Civic Intelligence Platform (CIP) v1
**Audit date:** 2026-08-21
**Release candidate:** branch `main`, commit `d5e00e1e` ("Improve queue scheduling and extend evidence manifest retries")
**Worktree state at audit:** dirty (uncommitted frontend/migration changes present — pilot must build from a clean tag)
**Method:** Static review of source, config, migrations, and CI/CD workflows, plus **live runtime probing** against an isolated MySQL database booted with the production `.env.cpanel` profile (`APP_ENV=production`, `CIP_DEBUG_OTP=true`). Cross-role, IDOR, and privilege-escalation tests were executed against a live API instance and the isolated database was dropped afterwards.

> Scope discipline: work was confined to the CIP repository. No secrets, `.env` contents, OTPs, or tokens are reproduced here. The isolated audit database (`cip_redaudit`) was created and dropped for this exercise only; production was never touched.

---

## Verdict

# NO-GO

Two independently sufficient P0 blockers were confirmed live, one of which is a complete platform authentication bypass that the deployment pipeline force-enables on every production deploy. CIP is **not** safe for pilot in its current state.

---

## Priority summary

| Priority | Count | IDs |
|---|---|---|
| P0 (pilot blocker) | 2 | RED-001, RED-002 |
| P1 (high pilot risk) | 2 | RED-003, RED-004 |
| P2 (medium) | 3 | RED-005, RED-006, RED-008 |
| P3 (low) | 1 | RED-007 |

---

## Findings

### RED-001 — Production debug-OTP enables full account takeover of any user (including super_admin)
**Severity:** P0 · **Domain:** Authentication · **Status:** VERIFIED (live) · **Go/No-Go:** BLOCKER

**Evidence**
- `backend/.env.cpanel` ships `APP_ENV=production` (line 2) together with `CIP_DEBUG_OTP=true` (line 114), tracked at HEAD.
- `AuthController::sendOtp()` returns the plaintext code as `debug_otp` whenever `config('cip.auth.debug_otp')` is true — gated on the flag, **not** the environment (`AuthController.php:62-65`).
- `.github/workflows/deploy-production.yml` includes `CIP_DEBUG_OTP` in its `FORCE_UPDATE_KEYS` loop, so every deploy overwrites the live server value with `true` from the template.
- `AuthenticationService::verifyOtp()` issues a Sanctum token with `abilities: ['*']` for **any** existing account matched by mobile number — OTP is an accepted login channel for staff and admin accounts, not just citizens.

**Attack scenario (executed)**
Knowing only a mobile number, `POST /auth/send-otp {mobile: <super_admin mobile>}` returned the OTP in the response body; `POST /auth/verify-otp` returned a valid super_admin token; `GET /admin/users` and `GET /admin/security-policies` both returned `200`.

**Impact**
Complete authentication bypass and privilege escalation for every role. Full citizen PII, evidence, audit trail, platform configuration, and control-plane are reachable by anyone who can guess or enumerate a mobile number. Guaranteed present in production because of the deploy force-push. Previously flagged in `docs/17-…Production-Readiness-Assessment.md` and still unremediated at HEAD.

**Remediation**
Set `CIP_DEBUG_OTP=false` in `.env.cpanel`; remove it from `FORCE_UPDATE_KEYS`; hard-gate `debug_otp` disclosure to `app()->environment('local')` only; add a deploy guard that fails the release if `APP_ENV=production` and `CIP_DEBUG_OTP=true`.
**Regression test:** feature test asserting `/auth/send-otp` never returns `debug_otp` when `APP_ENV=production`.

---

### RED-002 — Department officers can read the moderator queue and any report's full detail across all departments
**Severity:** P0 · **Domain:** Authorization / Department isolation / Privacy · **Status:** VERIFIED (live) · **Go/No-Go:** BLOCKER

**Evidence**
- `Gate::policy(Report::class, ModerationPolicy::class)` (`ModerationServiceProvider.php:42`). `ModerationPolicy::viewQueue()` / `viewReport()` grant access to the moderator roles **or** to anyone holding the `reports.view` permission (`ModerationPolicy.php:46-56`, `BasePolicy::hasRoleOrPermission`).
- `RolesAndPermissionsSeeder.php:65-66` grants `reports.view` to `department_officer` and `department_admin` — the canonical production seed.
- `ModerationQueueService::baseQueueQuery()` applies **no department scope** (`ModerationQueueService.php:20-26`).
- The `/moderator/*` route group carries only `auth:sanctum` + throttle, no role middleware.

**Attack scenario (executed)**
A department officer who is a member of BTP and BBMP_ENG (not BBMP_ELEC):
- `GET /moderator/queue` returned reports from **all four departments**, including the BBMP_ELEC report.
- `GET /moderator/reports/{BBMP_ELEC id}` returned `200` with `citizen_id`, exact `location {lat, lng}` (6-decimal precision), AI confidence, and fraud/duplicate scores.

**Scope of the bug (what is correctly enforced)**
Moderation *actions* (review/reject/merge/escalate) are blocked (`422` "not authorised to moderate"), moderation analytics is blocked (`403`), and the department-scoped `/reports` staff search and `/department/*` endpoints are correctly scoped. The break is **read exposure** via the moderator queue-list and report-detail endpoints only.

**Impact**
Confirmed department-isolation break and cross-department disclosure of citizen identity and exact GPS coordinates to staff who are not members of the owning department.

**Remediation**
Restrict `viewQueue` / `viewReport` to `moderator` / `super_admin` / `system` (remove the `reports.view` grant) and/or add explicit role middleware to the `/moderator` group; if department staff are ever intended to see the queue, apply `DepartmentScope` to it.
**Regression test:** department_officer → `/moderator/queue` and `/moderator/reports/{id}` must be `403`.

---

### RED-003 — OTP rate limit raised to 1000/hour per mobile and per IP for pilot
**Severity:** P1 · **Domain:** Authentication / anti-abuse · **Status:** VERIFIED · **Go/No-Go:** BLOCKER (absent documented executive risk acceptance)

**Evidence**
`database/migrations/2026_07_09_130000_raise_otp_rate_limit_for_pilot.php` sets `ratelimit.otp_per_hour = 1000` (self-labelled "PILOT ONLY … revert to 5 before go-live"), confirmed live in `security_policies`. `SecurityPolicyService::rateLimitOtpPerHour()` reads this row and it drives both the per-mobile/per-IP `OtpService` caps and the route limiter.

**Impact**
Defeats the PAS OTP enumeration / brute-force protection (SEC-004). Even after RED-001 is fixed, 1000/hour permits OTP brute force.

**Remediation**
Revert to 5/hour before pilot.

---

### RED-004 — Backup exists; restore and rollback are NOT VERIFIED
**Severity:** P1 · **Domain:** Backup / recovery · **Status:** NOT VERIFIED · **Go/No-Go:** BLOCKER per PAS exit criteria

**Evidence**
`deploy/production/backup-production.sh` (pre-deploy DB + evidence + env backup with `SHA256SUMS`), `rollback-production.sh`, and `docs/production-rollback-runbook.md` are present and well-structured (separate recovery domains, APP_KEY preservation). No evidence of an actual restore/rollback drill exists anywhere in the repo.

**Impact**
The PAS requires rollback and backup **verified** before pilot. Backup configured is not the same as restore verified.

**Remediation**
Execute a full restore + code rollback drill against a staging clone; record backup ID, checksums, and observed RTO.

---

### RED-005 — No external alerting/monitoring; operators blind to silent component failure
**Severity:** P2 · **Domain:** Observability · **Status:** VERIFIED (absence)

**Evidence**
`/api/v1/health` and `/health/ready` (DB, Redis, storage, queue, worker/scheduler heartbeats, scanner) and admin health endpoints exist, but there is no Sentry/PagerDuty/Prometheus/uptime/cron-monitor integration in the repo. Readiness is pull-only; on cPanel with cron-driven `queue:work --stop-when-empty`, a stalled queue or failed job is invisible until someone polls.

**Remediation**
Wire an uptime monitor to `/health/ready`, a cron heartbeat monitor, and error alerting before pilot.

---

### RED-006 — SLA breach detection job has `tries=1`, no backoff
**Severity:** P2 · **Domain:** Workflow / queues · **Status:** VERIFIED

`CheckSlaBreaches` runs with `tries=1` and no backoff. A single transient failure skips SLA evaluation until the next five-minute schedule and, combined with the monitoring gap (RED-005), can pass unnoticed. PAS WF-011 requires SLA alerts to fire.

**Remediation**
Add retries/backoff or make the scheduled command self-healing and alert on failure.

---

### RED-007 — Unauthenticated reverse-geocode proxy; dead `CIP_DEMO_MODE` flag
**Severity:** P3 · **Domain:** Security hygiene · **Status:** VERIFIED

`GET /public/geocode` is unauthenticated and proxies arbitrary lat/lng to an external geocoder (public-limiter throttled; no report correlation, so not a PII leak, but an abusable quota). `CIP_DEMO_MODE=true` in `.env.cpanel` is referenced nowhere in code (dead flag).

---

### RED-008 — Canonical local test path is broken on SQLite; suite not independently reproduced
**Severity:** P2 · **Domain:** QA / test confidence · **Status:** VERIFIED

**Evidence**
`phpunit.xml` forces `DB_CONNECTION=sqlite :memory:` (and `AGENTS.md` documents this as the local flow), but migration `2026_07_08_120000_widen_report_score_columns.php` uses raw `ALTER TABLE reports MODIFY …`, which SQLite rejects (`near "MODIFY": syntax error`). Every `RefreshDatabase` test therefore fails on the documented local path. CI is unaffected (uses MySQL). Locally, Faker version drift (`Unknown format "sentence"`) and a PHPUnit memory exhaustion under PHP 8.5 further prevented an independent green run.

**Impact**
False-confidence risk and SQLite-vs-MySQL divergence. CI green is the only test evidence, and CI runs the full suite only on the nightly schedule, not per-push.

**Remediation**
Guard the DDL migration for SQLite (or use the schema builder); treat a CI full-suite green run on the release commit as a required pre-pilot evidence gate.

---

## Positive confirmations (verified working)

- **Citizen ↔ citizen IDOR blocked** — citizen B → citizen A's report/timeline/media/manifest all `403` (live).
- **Admin RBAC** — citizen and department officer → all `/admin/*` = `403`; only super_admin `200` (live).
- **Media signing** — `/media/{id}/serve` rejects unsigned and tampered signatures (`403`); local disk forced through the signed, custody-logged route; S3 path uses presigned URLs; proof media re-verifies assignment/department scope.
- **MIME / evidence gates** — three-gate validation (server finfo mime + client-mime agreement + magic-byte sniff); quarantine on non-CLEAN scan; chain-of-custody download records.
- **Public privacy** — stats/heatmap/department-performance return aggregates only; heatmap grid-buckets to ~1.1 km with a >=5-report floor and 24-hour delay; no PII, exact coordinates, or evidence in any public response (live).
- **AI failure containment** — `AiPipelineOrchestrator` (tries=40, bounded backoff, `ShouldBeUnique`, `WithoutOverlapping`); `AiPipelineFailureHandler` routes failed/exhausted reports to `moderator_review` rather than dropping them.
- **Routing fallback** — `RoutingFallbackService` throws `ROUTING_FALLBACK_MISSING` rather than silently dropping unrouted reports.
- **Idempotency** — global `IdempotencyKey` middleware with a `(key, user_id, route, method)` unique constraint, pending reservations, crash recovery, and replay; offline PWA queue uses stable `crypto.randomUUID` idempotency keys persisted with drafts.
- **Deploy safety rails** — destructive-command guard (`migrate:fresh` / `db:wipe`), pre-deploy backup + checksum, scanner/redis host verification, APP_KEY preservation, CI-gated release, `migrate --force` only.

---

## Domain verdicts

| Domain | Verdict |
|---|---|
| Privacy (public API) | PASS |
| Privacy (staff cross-department path) | FAIL (RED-002) |
| Evidence integrity | PASS |
| Offline / PWA | NOT VERIFIED (real device) |
| AI failure containment | PASS |
| Workflow integrity | PASS |
| Backup / restore | NOT VERIFIED |
| Rollback | NOT VERIFIED |
| Observability | FAIL (no alerting) |
| Performance | NOT VERIFIED |
| Deployment safety | FAIL (force-pushes debug OTP) |

---

## Required before pilot (ordered path to GO)

1. **RED-001 (P0):** disable production debug-OTP, remove from force-push, hard-gate to `local`, add deploy guard. Evidence: feature test + live prod probe showing no `debug_otp`.
2. **RED-002 (P0):** restrict moderator queue/detail to moderator/super_admin/system and/or add role middleware. Evidence: department_officer → moderator endpoints = `403` regression tests.
3. **RED-003 (P1):** revert OTP cap to 5/hour.
4. **RED-004 (P1):** perform and record a full restore + rollback drill.
5. **RED-005 (P2):** wire uptime/cron/error alerting to `/health/ready`.
6. **RED-008 (P2):** SQLite-guard the DDL migration; capture a CI full-suite green run as evidence.
7. Cut a clean tagged release (no dirty worktree); run real-device offline (CIT-016/017/018) and staging load (PAS performance thresholds).

---

## CTO recommendation

1. **Should CIP pilot now?** No.
2. **What blocks it?** A production authentication bypass that hands out OTPs for any account (super_admin included) and is re-enabled on every deploy, plus a cross-department read leak of citizen identity and exact GPS through the moderator endpoints.
3. **Shortest safe path to GO?** Fix RED-001 and RED-002, revert the OTP cap, then prove — not merely implement — backup/restore and monitoring. Mostly config and policy changes; days of work.
4. **What must be proven, not merely implemented?** Debug-OTP off in the live production build; department_officer cannot read other departments' reports; backup actually restores; the automated suite is green in CI on this commit; offline capture survives on a real device.
