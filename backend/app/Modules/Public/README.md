# Public Module

## Purpose

Serves unauthenticated, privacy-safe platform statistics, heat-map data, and department performance metrics for the public landing page (and, from M17, the Public Transparency Portal). Every response is an aggregate: no citizen identity, no exact coordinates, no evidence.

## Key Classes

| Class | Role |
|-------|------|
| `PublicStatsService` | Platform-wide totals (report count, AI classification %, median assignment time) |
| `PublicHeatmapService` | Grid-bucketed report density for heat-map rendering |
| `PublicDepartmentPerformanceService` | Per-department resolution rate and median resolution time |
| `PublicStatsController` | `GET /api/v1/public/stats` |
| `PublicHeatmapController` | `GET /api/v1/public/heatmap` |
| `PublicDepartmentPerformanceController` | `GET /api/v1/public/departments/performance` |

## Privacy Guarantees

- Coordinates are rounded to 0.01 degrees (~1.1 km grid) before aggregation.
- Cells contain counts, never individual report locations.
- Department responses include only `name`, `code`, and aggregate counts.
- No internal notes, officer names, or citizen identity leave this module.

## Caching

All three endpoints are cached server-side for 5 minutes (`CACHE_TTL_SECONDS = 300`). Cache keys:
- `public.stats`
- `public.heatmap`
- `public.department_performance`

## Dependencies

- `Reports` (Report model, status history)
- `Departments` (Department model)
- `Shared` (BaseController, ApiResponse)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/public/stats` | `api.v1.public.stats` |
| GET | `/api/v1/public/heatmap` | `api.v1.public.heatmap` |
| GET | `/api/v1/public/departments/performance` | `api.v1.public.departments.performance` |

All three routes are throttled by the `public` rate limiter and require no authentication.
