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
| Citizen | mobile (10-digit) | OTP via SMS | `citizen` | Stateless login; one-time code; no password in V1. |
| Moderator | email | Password (bcrypt) + 2FA-ready | `moderator` | Staff portal user. Password + 2FA TOTP land in M10. |
| Department officer | email | Password + 2FA-ready | `department_officer` | Operations portal user. |
| Department admin | email | Password + 2FA-ready | `department_admin` | Manages the department's staff and SLAs. |
| Super admin | email | Password + 2FA + dual approval | `super_admin` | Protected role. Cannot be self-revoked. |
| System | n/a | Service account | `system` | Used by jobs, AI workers, and the connector framework. Cannot log in via the web. |
| Auditor | email | Password + 2FA | `auditor` | Read-only access to audit / security event streams. |

Citizen authentication is OTP-only in V1. Staff authentication is password-based. The 2FA surface is in place (the `two_factor_secret` and `two_factor_recovery_codes` columns exist on `users`); the TOTP enrollment flow ships with M10 / M12. See `docs/11` §8 for the password policy and `docs/11` §7 for session policy.

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

* **Roles** are the primary unit. They group permissions. Default roles are seeded in T-M2-019 / T-M2-029. Roles are guard-aware (the `web` guard is the default; `sanctum` is also wired in case staff auth shifts to a token-only path).
* **Permissions** are named strings (`reports.submit`, `moderation.override`, `users.create`, etc.). They are not user-facing in V1; clients see role names and (when eager-loaded) a flattened permission list.
* **Assignment.** `RoleService` (`backend/app/Modules/Users/Services/RoleService.php`) is the single entry point for granting / revoking roles. It is wrapped in a `DB::transaction` and emits `UserRoleChanged` on every change. The protected roles `super_admin` and `system` cannot be revoked by a single API call; they require a Super Admin Portal flow with dual approval (lands in M12).
* **Authorization.** `BasePolicy` (`backend/app/Modules/Users/Policies/BasePolicy.php`) implements the platform-wide `before()` rule: return `false` for unauthenticated / trashed / suspended / disabled / pending users, return `true` for `super_admin` and `system`, and `null` (defer) otherwise. Per-ability methods live in module-specific policies (e.g. `ReportPolicy@view`).
* **Super admin bypass.** `super_admin` and `system` always receive `true` from `BasePolicy::before()`. There is no per-ability short-circuit needed in the policy.

## 6. Rate Limiting

`docs/11` §21 defines a layered rate-limit model. The named limiters in `App\Providers\RouteServiceProvider` are:

| Limiter | Budget | Key | Applied to |
| --- | --- | --- | --- |
| `otp` | 5 / hour | IP | `POST /auth/send-otp` |
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

Standard event names:

* `LOGIN_SUCCESS` — emitted on a successful verify-otp or staff login.
* `LOGIN_FAILURE` — emitted on bad OTP, locked account, rate-limited OTP, etc.
* `REFRESH_TOKEN_REPLAY` — emitted when a single-use refresh token is presented twice. The session chain is revoked in the same transaction.
* `RATE_LIMITED` — emitted on every 429 from a named limiter.
* `SUSPICIOUS_DEVICE` — emitted by T-M2-018 when the device fingerprint changes mid-session.
* `USER_ROLE_CHANGED` / `USER_PERMISSION_CHANGED` — emitted by `RoleService`.

`security_events` is also append-only — the model layer rejects `update` and `delete`.

## 9. Device Fingerprinting

`DeviceFingerprintService` (T-M2-018) computes a stable hash from the parts of the request the server can read (User-Agent, Accept-Language, IP). The browser-only signals (Canvas, WebGL, Screen, Timezone) land with the PWA in M13 and will be added to the hash. The hash is written to `login_histories.device_fingerprint` and to `audit_logs` so security can correlate sessions across devices.

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
