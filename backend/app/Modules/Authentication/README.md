# Authentication Module

## Purpose

Handles citizen OTP authentication and staff password-based login. Issues and refreshes Laravel Sanctum tokens. Records login history for audit.

## Key Classes

| Class | Role |
|-------|------|
| `AuthenticationService` | Orchestrates OTP send/verify, password login, token refresh |
| `OtpService` | Generates, stores, and validates one-time passwords |
| `RefreshTokenService` | Manages refresh token rotation and revocation |
| `AuthController` | HTTP entry point for auth endpoints |
| `UserAuthenticated` | Event emitted on successful authentication |

## Models

- `Otp` — one-time password records
- `RefreshToken` — refresh token storage
- `LoginHistory` — audit trail of authentication events

## Dependencies

- `Shared` (BaseController, ApiResponse, IdempotencyKey middleware)
- `Users` (User model, referenced via `citizen_id`)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| POST | `/api/v1/auth/send-otp` | `api.v1.auth.send-otp` |
| POST | `/api/v1/auth/verify-otp` | `api.v1.auth.verify-otp` |
| POST | `/api/v1/auth/login` | `api.v1.auth.login` |
| POST | `/api/v1/auth/refresh` | `api.v1.auth.refresh` |
| POST | `/api/v1/auth/logout` | `api.v1.auth.logout` |
| GET | `/api/v1/auth/me` | `api.v1.auth.me` |

## Configuration

- OTP length, expiry, and rate limits are environment-driven.
- Staff login uses standard Laravel password hashing (bcrypt/argon2).
