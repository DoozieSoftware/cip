# Shared Module

## Purpose

Contains cross-cutting concerns and base classes used by all other modules. Provides common HTTP infrastructure, error handling, department scoping, and platform-wide services.

## Key Classes

| Class | Role |
|-------|------|
| `BaseController` | Abstract controller with common response helpers |
| `BaseService` | Abstract service with common patterns |
| `BasePolicy` | Abstract policy with common authorization patterns |
| `ApiResponse` | Standardized API response formatting |
| `ApiException` | Domain exception with error codes |
| `ModelImmutableException` | Thrown when mutating immutable records |
| `DepartmentScope` | Query scoping by department |
| `PlatformHealthService` | Health check aggregation |
| `SchedulerService` | Scheduled job management |
| `SystemUserService` | System-level user operations |

## Middleware

- `RequestId` — assigns unique request ID for tracing
- `IdempotencyKey` — prevents duplicate submissions

## Enums

- `ErrorCode` — machine-readable error codes

## Controllers

- `PlatformHealthController` — health summary and component status
- `SchedulerController` — job listing, run-now, pause, resume

## Dependencies

None. This is the foundational module with no internal dependencies.

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/health` | `api.v1.health.live` |
| GET | `/api/v1/health/ready` | `api.v1.health.ready` |
| GET | `/api/v1/openapi.yaml` | `api.v1.openapi` |
| GET | `/api/v1/admin/health` | `api.v1.admin.health.summary` |
| GET | `/api/v1/admin/health/components` | `api.v1.admin.health.components` |
| GET | `/api/v1/admin/scheduler/jobs` | `api.v1.admin.scheduler.jobs.index` |
| POST | `/api/v1/admin/scheduler/jobs/{id}/run-now` | `api.v1.admin.scheduler.jobs.run-now` |
| POST | `/api/v1/admin/scheduler/jobs/{id}/pause` | `api.v1.admin.scheduler.jobs.pause` |
| POST | `/api/v1/admin/scheduler/jobs/{id}/resume` | `api.v1.admin.scheduler.jobs.resume` |
