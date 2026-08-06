# Routing Module

## Purpose

Determines which department should handle a report based on category, location (ward/zone), severity, and configurable rules. Supports primary routing, fallback routing, secondary routing, and manual reassignment.

## Key Classes

| Class | Role |
|-------|------|
| `RoutingEngine` | Evaluates rules to determine department assignment |
| `RoutingAdminService` | CRUD for routing rules |
| `RoutingFallbackService` | Handles cases where no rule matches |
| `SecondaryRoutingService` | Additional routing passes |
| `AssignmentService` | Creates department/officer assignments |
| `ReassignService` | Manual reassignment logic |
| `RoutingCondition` | Evaluates individual rule conditions |
| `RoutingRepository` | Persistence for routing rules |
| `RoutingRule` | Rule model (category, ward, department, priority) |

## Value Objects

- `RoutingDecision` — Immutable result of routing evaluation

## Dependencies

- `Reports` (Report model, category and location)
- `Departments` (Department model, assignment target)
- `Shared` (BaseController, ApiResponse)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/admin/routing-rules` | `api.v1.admin.routing-rules.index` |
| POST | `/api/v1/admin/routing-rules` | `api.v1.admin.routing-rules.store` |
| POST | `/api/v1/admin/routing-rules/reorder` | `api.v1.admin.routing-rules.reorder` |
| GET | `/api/v1/admin/routing-rules/options` | `api.v1.admin.routing-rules.options` |
| GET | `/api/v1/admin/routing-rules/{rule}` | `api.v1.admin.routing-rules.show` |
| PUT | `/api/v1/admin/routing-rules/{rule}` | `api.v1.admin.routing-rules.update` |
| DELETE | `/api/v1/admin/routing-rules/{rule}` | `api.v1.admin.routing-rules.destroy` |
| POST | `/api/v1/admin/reports/{report}/reassign` | `api.v1.admin.reports.reassign` |
