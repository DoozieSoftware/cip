# Reports Module

## Purpose

The core domain module. Manages the full report lifecycle: creation, evidence attachment, submission, citizen tracking, staff search, and timeline. Reports are the central aggregate of the platform.

## Key Classes

| Class | Role |
|-------|------|
| `ReportService` | Orchestrates report creation and submission |
| `LocationService` | Geocoding, ward detection, spatial lookup |
| `ReportRepository` | Persistence and complex queries |
| `AdminReportRepository` | Cross-department search queries |
| `ReportTypeRepository` | Report category management |
| `ReportsController` | Citizen and staff report endpoints |
| `AdminReportController` | Super Admin cross-department search |
| `AdminReportTypeController` | Report type CRUD |
| `SubmitReportDto` / `CreateReportDto` | Input DTOs |
| `LocationAccuracy` | Custom validation rule |

## Models

- `Report` — the central aggregate
- `ReportType` — configurable categories (pothole, garbage, etc.)
- `ReportStatus` — workflow status values
- `ReportPriority` — priority levels
- `Location` — GIS coordinates and resolved area
- `ReportAssignment` — department/officer ownership
- `ReportStatusHistory` — immutable status change log
- `InternalNote` — department-private notes
- `IdempotencyKey` — duplicate submission prevention

## Events

- `ReportAssigned` — department/officer assigned
- `ReportStatusChanged` — workflow state transition
- `ReportTypeCreated` / `Updated` / `Deleted` — category changes

## Dependencies

- `Users` (citizen, assigned officer)
- `Departments` (department assignment)
- `Workflow` (status, transitions)
- `Media` (evidence files)
- `Shared` (BaseController, ApiResponse, DepartmentScope)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/report-types` | `api.v1.report-types.index` |
| POST | `/api/v1/reports` | `api.v1.reports.store` |
| POST | `/api/v1/reports/{id}/submit` | `api.v1.reports.submit` |
| GET | `/api/v1/citizen/dashboard` | `api.v1.citizen.dashboard` |
| GET | `/api/v1/citizen/reports` | `api.v1.citizen.reports.index` |
| GET | `/api/v1/citizen/reports/{id}` | `api.v1.citizen.reports.show` |
| GET | `/api/v1/reports` | `api.v1.reports.index` |
| GET | `/api/v1/reports/{id}` | `api.v1.reports.show` |
| GET | `/api/v1/reports/{id}/timeline` | `api.v1.reports.timeline` |
| GET | `/api/v1/admin/reports` | `api.v1.admin.reports.index` |
| GET | `/api/v1/admin/report-types` | `api.v1.admin.report-types.index` |
| POST | `/api/v1/admin/report-types` | `api.v1.admin.report-types.store` |
| PUT | `/api/v1/admin/report-types/{type}` | `api.v1.admin.report-types.update` |
| DELETE | `/api/v1/admin/report-types/{type}` | `api.v1.admin.report-types.destroy` |
