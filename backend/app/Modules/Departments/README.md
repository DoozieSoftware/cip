# Departments Module

## Purpose

Manages government departments, organizations, officer memberships, and department-level report operations. Provides the department portal API for report lifecycle management.

## Key Classes

| Class | Role |
|-------|------|
| `DepartmentRepository` | Persistence for department records |
| `OrganizationRepository` | Persistence for organization hierarchy |
| `GeographyRepository` | Ward/zone/district lookups |
| `DepartmentReportActionsController` | Accept, start, progress, resolve, close reports |
| `DepartmentDashboardController` | Department dashboard summary |
| `DepartmentReportListController` | Paginated report listing with filters |
| `DepartmentReportExportController` | CSV/XLSX/PDF export |
| `DepartmentMembershipController` | Officer-department associations |

## Models

- `Department` — government department record
- `Organization` — parent organization entity
- `DepartmentUserPivot` — officer membership with role/scope

## Dependencies

- `Users` (User model, officer accounts)
- `Reports` (Report model, assignments)
- `Shared` (DepartmentScope, BasePolicy)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/department/dashboard` | `api.v1.department.dashboard` |
| GET | `/api/v1/department/memberships` | `api.v1.department.memberships.index` |
| GET | `/api/v1/department/reports` | `api.v1.department.reports.index` |
| GET | `/api/v1/department/reports/export` | `api.v1.department.reports.export` |
| GET | `/api/v1/department/reports/{report}` | `api.v1.department.reports.show` |
| POST | `/api/v1/department/reports/{report}/accept` | `api.v1.department.reports.accept` |
| POST | `/api/v1/department/reports/{report}/start` | `api.v1.department.reports.start` |
| POST | `/api/v1/department/reports/{report}/progress` | `api.v1.department.reports.progress` |
| POST | `/api/v1/department/reports/{report}/resolve` | `api.v1.department.reports.resolve` |
| POST | `/api/v1/department/reports/{report}/close` | `api.v1.department.reports.close` |
| POST | `/api/v1/department/reports/{report}/note` | `api.v1.department.reports.note` |
| POST | `/api/v1/department/reports/{report}/photos` | `api.v1.department.reports.photos.store` |
| GET | `/api/v1/admin/departments` | `api.v1.admin.departments.index` |
| POST | `/api/v1/admin/departments` | `api.v1.admin.departments.store` |
| PUT | `/api/v1/admin/departments/{department}` | `api.v1.admin.departments.update` |
| DELETE | `/api/v1/admin/departments/{department}` | `api.v1.admin.departments.destroy` |
| GET | `/api/v1/admin/organizations` | `api.v1.admin.organizations.index` |
| POST | `/api/v1/admin/organizations` | `api.v1.admin.organizations.store` |
