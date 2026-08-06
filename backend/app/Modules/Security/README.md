# Security Module

## Purpose

Provides audit logging, security event tracking, device fingerprinting, and security policy management. Records immutable audit trails for all significant actions and detects suspicious activity.

## Key Classes

| Class | Role |
|-------|------|
| `SecurityEventService` | Records and queries security events |
| `SecurityPolicyService` | Manages configurable security policies |
| `SecurityDashboardService` | Aggregated security metrics |
| `DeviceFingerprintService` | Device identification and validation |
| `AuditLogController` | Audit log search endpoint |
| `SecurityDashboardController` | Security dashboard endpoint |
| `AdminSecurityPolicyController` | Security policy CRUD |
| `AuditMiddleware` | Automatic audit logging middleware |

## Models

- `AuditLog` — immutable audit records (user, entity, action, before/after, ip, device)
- `SecurityEvent` — suspicious activity records (root detection, mock GPS, replay, VPN, rate limit)
- `SecurityPolicy` — configurable security rules

## Dependencies

- `Shared` (BaseController, ApiResponse)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/admin/audit-logs` | `api.v1.admin.audit-logs.index` |
| GET | `/api/v1/admin/security/dashboard` | `api.v1.admin.security.dashboard` |
| GET | `/api/v1/admin/security-policies` | `api.v1.admin.security-policies.index` |
| POST | `/api/v1/admin/security-policies` | `api.v1.admin.security-policies.store` |
| GET | `/api/v1/admin/security-policies/{key}` | `api.v1.admin.security-policies.show` |
| PUT | `/api/v1/admin/security-policies/{key}` | `api.v1.admin.security-policies.update` |
| DELETE | `/api/v1/admin/security-policies/{key}` | `api.v1.admin.security-policies.destroy` |
