# Current Milestone — M2: Identity, Auth & RBAC Core

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** In Progress (22 / 30 tasks complete)
**Last updated:** 2026-06-26 20:40 IST (after T-M2-023 done)
**Source Documents:** `AGENTS.md`, `.codex/roadmap.md` §M2, `.codex/task_queue.md` §M2, `docs/02` §4 §11 §17, `docs/03` §13–14 §19, `docs/05` §5, `docs/11` §6–9 §19 §21 §22 §28–29, `docs/14` §19 §37, `docs/15` §6–7

> M1 is complete (22/22). M2 picks up where M1 left off and lands a production-grade identity layer: citizens authenticate via OTP, staff via username + password (2FA-ready), and Spatie Permission powers RBAC. JWT lifecycle with refresh-token rotation, audit logging on every mutating request, and rate limiters from `docs/11` §21 are all in scope.

---

## 1. Current Milestone

* **Milestone ID:** M2
* **Title:** Identity, Authentication & Role-Based Access Control
* **Estimated complexity:** **High**
* **Estimated duration:** 2 weeks
* **Total tasks:** 30 (T-M2-001 → T-M2-030)
* **Depends on:** M1 (buildable repo, CI, /health endpoint, base `Shared` utilities)
* **Unblocks:** M3 (Master Configuration & Geography) — first M3 task depends on `T-M2-002`; M4+ depend on `T-M2-019` (RoleService) for authorization.

---

## 2. Objective

Build a production-grade identity layer that supports three user personas with different auth modes, an extensible RBAC model powered by Spatie Permission, full JWT lifecycle with refresh-token rotation, audit logging on every security-sensitive action, and configurable rate limiters per `docs/11` §21.

---

## 3. Deliverables (per `.codex/roadmap.md` §M2)

* Migrations: `users` (rewrite), `otps`, `refresh_tokens`, `login_histories`, `security_events`, `audit_logs`
* Eloquent models, factories, seeders
* `OtpService` (5/hour per mobile+IP, configurable expiry, hashed code only)
* `SmsGatewayInterface` + `LogSmsGateway` driver
* `POST /api/v1/auth/send-otp`, `POST /api/v1/auth/verify-otp`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
* Sanctum personal access tokens + opaque refresh tokens (rotated on each refresh)
* `RoleService`, `PermissionService`, `BasePolicy` with `super_admin` bypass
* Default roles seeded: `citizen`, `moderator`, `department_officer`, `department_admin`, `super_admin`, `system`, `auditor`
* `AuditMiddleware` writing to `audit_logs` on every mutating request
* `DeviceFingerprintService` (UA, screen, timezone, language, canvas/WebGL best-effort)
* Rate limiters `otp`, `citizen`, `uploads`, `moderator`, `department`, `admin` registered in `RouteServiceProvider`
* OpenAPI extended for auth endpoints
* `docs/auth.md` authored
* Pest feature coverage for OTP throttle, refresh rotation, RBAC denials

---

## 4. Scope

* Citizen auth: mobile + OTP only (no password).
* Staff auth (moderator/department/admin): email + password, password meets `docs/11` §8 (12+ chars, complexity, 5-password history, 90-day expiry).
* Sanctum personal access tokens issued on `verify-otp` (citizen) and on a future staff-login endpoint (M12).
* Refresh tokens are opaque random strings; `parent_id` chains each rotation; reuse is detected and revokes the entire chain.
* Audit middleware records the principal, the route, the entity, before/after JSON, IP, device fingerprint, request id, and the timestamp; rows are append-only.
* Rate limiters are configured in `App\Providers\RouteServiceProvider`; `throttle:<name>` middleware references them.

---

## 5. Out of Scope

* Government SSO, passkeys, WebAuthn (`docs/11` §6 future work).
* Staff email/password login endpoint (lands in M12 Super Admin / Department portals).
* `audit_logs` are not exposed via API in M2.
* 2FA (TOTP) — scaffolded (column on users), but not enforced in M2.
* Frontend M2 work (citizen login UI) — comes in M13.

---

## 6. Exit Criteria

* All 5 `auth/*` endpoints return correct status codes per `docs/05` §5.
* `users` table uses UUID PK, unique indexes on `mobile` and `email`, soft deletes.
* Refresh token rotation invalidates the previous token; reuse logs a security event.
* Audit rows exist for login, logout, failed-login, OTP requests, role changes.
* `RateLimiter::for('otp')` returns `Limit::perHour(5)`; `POST /api/v1/auth/send-otp` returns 429 on the 6th call within an hour.
* OpenAPI spec validates and Swagger UI renders the new endpoints.
* Pest feature tests for OTP throttle, refresh rotation, RBAC denials all pass.
* PHPStan max level on `app/` clean; Pint clean; coverage on touched code ≥ 90 %.

---

## 7. Documents to Read Before Implementation

* `AGENTS.md` — coding rules, module ownership, never-hardcode rule.
* `docs/04` §6 (User Domain), §15 (Audit Domain), §16 (Security Domain).
* `docs/05` §5 (Authentication APIs).
* `docs/11` §6–10 (auth, session, password, authz, device fingerprinting), §21 (rate limits), §28–29 (audit, security events).
* `docs/03` §13–14 (auth, authz), §19 (audit).

---

## 8. Implementation Status

* Active task: **T-M2-024 — Add UserResource with roles and permissions** (next: extend `backend/app/Modules/Users/Http/Resources/UserResource.php` with roles/permissions, add unit test `tests/Unit/Users/UserResourceTest.php`).
* Blockers: none.
* Next task on completion: T-M2-002 (User model).
