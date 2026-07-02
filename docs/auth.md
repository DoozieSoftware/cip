# Authentication & Authorization

**Project:** Civic Intelligence Platform
**Status:** M2 — production-grade identity layer
**Audience:** Backend engineers, frontend engineers, security reviewers, SRE
**Spec source of truth:** `docs/05` §5 (Authentication APIs), `docs/11` §6–§10 + §21 + §28–29
**API surface:** `/api/v1/auth/*` (see `backend/storage/api-docs/openapi.yaml`, the Authentication tag)

This document explains how the M2 identity layer works end to end. It is the on-ramp for new backend / frontend contributors and the reference reviewers consult when assessing changes to the auth surface. It does not restate the full product vision or the full security model; it only covers identity, session, RBAC, audit, rate limiting, and the security event surface as they exist in M2.

---

## 1. Personas and Auth Modes

| Persona | Identifier | Auth mode | Default role | Notes |
| --- | --- | --- | --- | --- |
| Citizen | mobile (10-digit) | OTP via SMS | `citizen` | Stateless login; one-time code; no password. |
| Moderator | mobile (10-digit) | Password (`POST /auth/login`) | `moderator` | Staff portal user. |
| Department officer | mobile (10-digit) | Password | `department_officer` | Operations portal user. |
| Department admin | mobile (10-digit) | Password | `department_admin` | Manages the department's staff and SLAs. |
| Super admin | mobile (10-digit) | Password | `super_admin` | Protected role. Cannot be self-revoked. |
| System | n/a | Service account | `system` | Used by jobs, AI workers, and the connector framework. Cannot log in via the web. |
| Auditor | mobile (10-digit) | Password | `auditor` | Read-only access to audit / security event streams. |

Citizen authentication is OTP-only, final. Staff authentication is
password-based via `POST /api/v1/auth/login`, keyed by the same
`users.mobile` field OTP uses — there is no separate email-login
path. **2FA/TOTP is not implemented** — `two_factor_secret` /
`two_factor_recovery_codes` columns exist on `users` but no
enrollment or challenge flow reads or writes them; treat any
reference to "2FA-ready" elsewhere as aspirational until an
enrollment endpoint actually exists. See §5a below for the password
policy and `docs/11` §7 for session policy.

## 2. Happy Path: Citizen Login

```
   ┌─────────┐                              ┌─────────┐
   │ Citizen │                              │  CIP    │
   │   PWA   │                              │ Backend │
   └────┬────┘                              └────┬────┘
        │  POST /api/v1/auth/send-otp           │
        │  { mobile: "9876543210" }             │
        │ ──────────────────────────────────────▶
        │                                       │ - rate-limit (5/h per IP)
        │                                       │ - bcrypt-hash the OTP
        │                                       │ - dispatch via SmsGateway
        │  200 { data: { otp_sent: true } }     │
        │ ◀──────────────────────────────────────
        │                                       │
        │  POST /api/v1/auth/verify-otp         │
        │  { mobile, code }                     │
        │ ──────────────────────────────────────▶
        │                                       │ - lookup latest unused OTP
        │                                       │ - bcrypt-compare
        │                                       │ - upsert user (first contact)
        │                                       │ - assign `citizen` role (idempotent)
        │                                       │ - issue Sanctum PAT
        │                                       │ - issue opaque refresh token
        │                                       │ - record LoginHistory
        │                                       │ - emit UserAuthenticated event
        │  200 { data: { token, refresh_token,  │
        │              refresh_expires_at,      │
        │              user: {...} } }          │
        │ ◀──────────────────────────────────────
```

The refresh token is the **only** time the client can capture it. Store it in a non-HTTP-only storage (e.g. `localStorage` for the PWA, `EncryptedSharedPreferences` for the eventual Android wrapper). The Sanctum access token goes into the `Authorization: Bearer …` header on every subsequent request.

## 2a. Happy Path: Staff Password Login

```
   ┌─────────┐                              ┌─────────┐
   │  Staff  │                              │  CIP    │
   │ Portal  │                              │ Backend │
   └────┬────┘                              └────┬────┘
        │  POST /api/v1/auth/login              │
        │  { mobile, password }                 │
        │ ──────────────────────────────────────▶
        │                                       │ - rate-limit (10/h per IP+mobile)
        │                                       │ - lockout check (5 failures / 15 min)
        │                                       │ - Hash::check(password, users.password)
        │                                       │ - issue Sanctum PAT
        │                                       │ - issue opaque refresh token
        │                                       │ - record LoginHistory
        │                                       │ - emit LOGIN_SUCCESS security event
        │                                       │ - emit UserAuthenticated(channel: 'password')
        │  200 { data: { token, refresh_token,  │
        │              refresh_expires_at,      │
        │              user: {...} } }          │
        │ ◀──────────────────────────────────────
```

Citizens have no `password` column value (`null`), so this endpoint
always returns 401 for a citizen mobile — it never confirms or
denies whether a mobile is registered. A wrong password, an unknown
mobile, and a citizen mobile are all indistinguishable 401 responses
from the outside. After 5 failed attempts for the same mobile within
a rolling 15-minute window, the endpoint returns 429 even if the
6th attempt uses the correct password (`AuthenticationService::assertNotLockedOut`).

`POST /auth/login` is implemented in `AuthenticationService::loginWithPassword()`
and mirrors `verifyOtp()`'s token-issuance shape exactly (same
`{token, refresh, user, access_token}` return array), so
`AuthController` reuses the same response-building code for both.

## 3. JWT / Access Token Lifecycle

* **Issuance.** `POST /auth/verify-otp` returns a Sanctum **personal access token** (PAT). The PAT id, the plaintext, the user's id, and the expiry are stored in `personal_access_tokens`. The plaintext is shown to the client exactly once and is **not recoverable** server-side.
* **Expiry.** PATs expire after 60 minutes by default (`SANCTUM_EXPIRATION`). The expiry is rendered as `data.token.expires_at` in the verify-otp response so the PWA can schedule a silent refresh.
* **Validation.** Sanctum's `auth:sanctum` middleware checks the bearer token, confirms it is not revoked, and resolves the user model. The default `users` provider is used.
* **Revocation.** `POST /auth/logout` deletes the current PAT row and revokes all refresh tokens issued to this user. The next request with the same bearer returns 401. Logout is idempotent (a second call sees the bearer is already gone).
* **Immutability.** PATs and refresh tokens are not editable from the API; only the logout / refresh-rotation paths mutate them.

## 4. Refresh Token Rotation

`POST /auth/refresh` rotates the refresh token. The implementation is **single-use**:

1. The client presents the plaintext refresh token.
2. The server hashes the token (sha256) and looks up the corresponding `refresh_tokens` row.
3. If the row is missing, expired, or already used → 401 with `code: REFRESH_TOKEN_INVALID`.
4. If the row was already used → the entire session chain is revoked (this is the replay-protection rule from `docs/11` §23) and a `REFRESH_TOKEN_REPLAY` security event is emitted.
5. Otherwise, the row is marked `used_at = now()` and a new (token, hash, expires_at) tuple is issued. The new tokens are returned to the client.
6. The previous PAT is also revoked; the client receives a fresh access token with the new refresh token.

Refresh tokens are 64 random URL-safe characters, hashed with sha256 in storage. The plaintext is shown exactly once on issuance and again on rotation.

## 5. Roles, Permissions, and Policies

Authorization is driven by Spatie Permission (`spatie/laravel-permission`).

* **Roles** are the primary unit. They group permissions. Default roles are seeded in T-M2-019 / T-M2-029. Roles are guard-aware — the seeded roles use the `web` guard exclusively (`RolesAndPermissionsSeeder`). There is **no** Spatie guard named `sanctum`; Sanctum's own guard is configured as `api` in `config/auth.php`. Any reference to a `sanctum`-named Spatie guard is a naming error, not a real guard.
* **Permissions** are named strings (`reports.submit`, `moderation.override`, `users.create`, etc.). They are not user-facing in V1; clients see role names and (when eager-loaded) a flattened permission list.
* **Assignment.** `RoleService` (`backend/app/Modules/Users/Services/RoleService.php`) is the single entry point for granting / revoking roles. It is wrapped in a `DB::transaction` and emits `UserRoleChanged` on every change. The protected roles `super_admin` and `system` **cannot be revoked at all** through `RoleService` — `PROTECTED_ROLES` throws `ROLE_PROTECTED` (422) unconditionally for anyone. There is no dual-approval workflow; the current behaviour is a hard block, which is a stricter (if less flexible) guarantee than the dual-approval flow this document previously described.
* **Authorization.** `BasePolicy` (`backend/app/Modules/Shared/Policies/BasePolicy.php` — **not** `Users/Policies`, a stale path this document used to cite) implements the platform-wide `before()` rule: return `false` for unauthenticated / trashed / suspended / disabled / pending users, return `true` for `super_admin` and `system`, and `null` (defer) otherwise. Per-ability methods live in module-specific policies (e.g. `ReportPolicy@view`).
* **Super admin bypass.** `super_admin` and `system` always receive `true` from `BasePolicy::before()`. There is no per-ability short-circuit needed in the policy.

## 5a. Password Policy

Staff account passwords (login and admin create/update) are validated by
`SecurityPolicyService::passwordRule()` (`backend/app/Modules/Security/Services/SecurityPolicyService.php`),
which reads the `password.min_length` row from `security_policies` and
builds a Laravel `Illuminate\Validation\Rules\Password` rule from it.
Per `docs/11` §8 the defaults are: minimum length **12**, mixed case,
at least one number, at least one special character. A Super Admin
editing the `password.min_length` policy through the Security
Policies admin screen changes this rule's behaviour on the next
request — no deploy required. This is the first `security_policies`
row with a real runtime effect; the remaining rows (`otp.expiry_seconds`,
`jwt.access_ttl_minutes`, `ratelimit.otp_per_hour`, etc.) are still
CRUD-only and not yet read by any code path — do not assume editing
them changes behaviour until their own wiring lands.

Password **history** (5 prior passwords) and **expiry** (90 days) from
`docs/11` §8 have no backing storage yet (no `password_histories`
table, no `password_changed_at` tracking) — only the complexity rule
is enforced today.

## 6. Rate Limiting

`docs/11` §21 defines a layered rate-limit model. The named limiters in `App\Providers\RouteServiceProvider` are:

| Limiter | Budget | Key | Applied to |
| --- | --- | --- | --- |
| `otp` | 5 / hour | IP | `POST /auth/send-otp` |
| `login` | 10 / hour | IP + mobile | `POST /auth/login` (stricter than OTP: a password is a standing secret, brute-forceable, unlike a short-lived issued code) |
| `citizen` | 60 / minute | user id (or IP pre-auth) | `POST /auth/verify-otp`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| `uploads` | 120 / hour | user id | T-M5 upload endpoints |
| `moderator` | 300 / minute | user id | M10 moderator portal endpoints |
| `department` | 300 / minute | user id | M11 operations portal endpoints |
| `admin` | 600 / minute | user id | M12 super admin portal endpoints |

All limiters are keyed per-limiter (`otp:`, `citizen:`, etc.) so the same user id never collides across limiters in the shared cache. The 100 MB/hour **byte** cap on uploads is a separate enforcement path (T-M5-xxx) — the named limiter is a request-count backstop, not the primary control.

When a limiter is hit, Laravel throws `ThrottleRequestsException`. The handler in `bootstrap/app.php` returns a 429 with the standard envelope and `code: RATE_LIMITED`, preserving the `Retry-After` and `X-RateLimit-*` headers from the framework. The numeric values are V1 defaults; M3 will move them to the `settings` table (decision deferred to M3).

## 7. Audit Logging

Every mutating request (`POST`, `PUT`, `PATCH`, `DELETE`) flows through `AuditMiddleware` (T-M2-020). The middleware:

1. Captures the request method, path, status code, user id (or null if anonymous), IP, and a hash of the device fingerprint.
2. Writes an `audit_logs` row inside a `DB::transaction` so a failed insert does not silently lose the audit.
3. Never blocks the response — audit failures are logged to the application log and the row is dropped (a `recordSafe`-style fail-open).
4. The `audit_logs` table is append-only; the `AuditLog` model overrides `update` and `delete` to throw.

The middleware is wired globally on the API group in `backend/bootstrap/app.php`.

## 8. Security Events

`SecurityEventService` (T-M2-021) is the canonical write path for security events. It exposes:

* `record(event, severity, metadata, user, ip, userAgent)` — strict; throws on bad inputs.
* `recordSafe(event, severity, metadata, user, ip, userAgent)` — fail-open; logs and returns null on any failure. Hot paths (audit middleware, login endpoint) use this so a security event write failure never breaks the user flow.
* `info`, `warning`, `critical` convenience wrappers.

Standard event names — status reflects what is actually wired today, not the original aspiration:

* `LOGIN_SUCCESS` / `LOGIN_FAILURE` — **wired**, but only for the staff password flow (`AuthenticationService::loginWithPassword()`). The citizen OTP flow (`verifyOtp()`) does not yet emit either event — extending it is a tracked fast-follow, not done here.
* `REFRESH_TOKEN_REPLAY` — **wired**, emitted when a single-use refresh token is presented twice (`RefreshTokenService`). The session chain is revoked in the same transaction.
* `RATE_LIMITED` — **not wired**. The 429 handler in `bootstrap/app.php` builds the error envelope but never calls `SecurityEventService`. Treat any dashboard widget that implies rate-limit events are tracked as reading an empty bucket today.
* `SUSPICIOUS_DEVICE` — **not wired**. No code path ever records this event; `DeviceFingerprintService` computes a hash but nothing compares it across sessions or raises this event on a change.
* `USER_ROLE_CHANGED` / `USER_PERMISSION_CHANGED` — **dispatched as Laravel events** by `RoleService`, but have no registered listener, so no `security_events` row is ever written for either. The event classes exist; the bridge into `SecurityEventService` does not.

`security_events` is also append-only — the model layer rejects `update` and `delete`.

## 9. Device Fingerprinting

`DeviceFingerprintService` (T-M2-018) computes a stable hash from the parts of the request the server can read (User-Agent, Accept-Language, IP). The browser-only signals (Canvas, WebGL, Screen, Timezone) land with the PWA in M13 and will be added to the hash. **The hash is written to `audit_logs` (via `AuditMiddleware`) but not to `login_histories.device_fingerprint`** — both `verifyOtp()` and `loginWithPassword()` currently write `device_fingerprint: null` on every row. Wiring the fingerprint into login history is a tracked fast-follow, not yet done.

## 10. Error Envelope and Error Codes

All auth endpoints return the standard envelope (`docs/03` §20):

```json
{
  "success": true,
  "message": "OK",
  "data": { ... },
  "errors": null,
  "code": null,
  "trace_id": "0HMM8M3N5G2F1:00000001",
  "meta": null
}
```

Errors share the same envelope with `success: false` and a non-null `code`. The most common auth codes:

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | No bearer, or bearer revoked / expired. |
| 401 | `OTP_INVALID` | Wrong / expired / already-used OTP. |
| 401 | `REFRESH_TOKEN_INVALID` | Refresh token missing / expired / already used. |
| 401 | `REFRESH_TOKEN_REPLAY` | Single-use refresh token was presented twice — session chain revoked. |
| 422 | `VALIDATION_FAILED` | Body failed `FormRequest` validation. |
| 422 | `ROLE_NOT_FOUND` | `RoleService::assign` was given an unknown role name. |
| 422 | `ROLE_PROTECTED` | Tried to revoke a protected role (`super_admin`, `system`). |
| 422 | `INVALID_EVENT` / `INVALID_SEVERITY` | `SecurityEventService::record` was given bad input. |
| 429 | `RATE_LIMITED` | Named rate limiter hit. `Retry-After` header is set. |

The `trace_id` is the value of the `X-Request-Id` request header (or the Laravel-generated one if the client did not supply it). It is propagated through logs, audit rows, and security events for cross-service correlation.

## 11. Cross-references

* `docs/05` §5 — Authentication APIs.
* `docs/11` §6 — Authentication Security.
* `docs/11` §7 — Session Security.
* `docs/11` §8 — Password Policy.
* `docs/11` §9 — Authorization.
* `docs/11` §10 — Device Fingerprinting.
* `docs/11` §21 — Rate Limiting.
* `docs/11` §23 — Replay Protection.
* `docs/11` §28 — Audit Logging.
* `docs/11` §29 — Security Events.
* `docs/14` §37 — Documentation policy (this file is the reference).

## 12. Manual Review Checklist

When reviewing a change to the auth surface, verify:

- [ ] No business logic in `AuthController`. All flows go through `OtpService`, `AuthenticationService`, or `RefreshTokenService`.
- [ ] Every mutating route has `auth:sanctum` (or the appropriate guard) and a named rate limiter.
- [ ] `BasePolicy::before()` is the single source of truth for "should this user reach the per-ability check?".
- [ ] `RoleService` is the only caller of `Spatie\Permission\Models\Role` mutations from app code.
- [ ] `SecurityEventService::recordSafe` is used on every hot path; `record` only on admin / batch paths.
- [ ] `audit_logs` and `security_events` are append-only — no test or migration mutates existing rows.
- [ ] `UserResource` is the only serializer for the `users` table; controllers never `return User::find(...)`.
- [ ] The `trace_id` is present in every response and in every audit / security event.
- [ ] Tests for the new code exist at the unit (Service / Policy) and feature (HTTP envelope + auth state) levels.
- [ ] `vendor/bin/pest`, `vendor/bin/pint --test`, and `vendor/bin/phpstan analyse app/` all pass.
