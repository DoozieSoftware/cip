# M11 — Operations Portal (Department & Administration)

The Operations Portal is the third end-user surface of the Civic Intelligence Platform. It serves two distinct personas that share the same department boundary:

- **Department Officer** — a government employee who triages, works, and closes reports routed to their department.
- **Super Administrator / Department Administrator** — a platform operator who configures the department surface (officers, SLAs, working hours, holiday calendar).

This document complements `docs/08-Department-Portal-Specification.md` (the M11 product spec) with the implementation-level details a maintainer needs.

---

## 1. Backend surface

### 1.1 Routes

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET`  | `/api/v1/department/dashboard`               | `auth:sanctum` + `can:viewDashboard` | M11 — `T-M11-007` |
| `GET`  | `/api/v1/department/reports`                | `auth:sanctum` + `can:viewReports`  | M11 — `T-M11-008` |
| `GET`  | `/api/v1/department/reports/export`         | `auth:sanctum` + `can:viewReports`  | M11 — `T-M11-010` (CSV / XLSX / PDF) |
| `POST` | `/api/v1/department/reports/{report}/accept`  | `auth:sanctum` + `can:accept,report`  | M11 — `T-M11-006` |
| `POST` | `/api/v1/department/reports/{report}/start`   | `auth:sanctum` + `can:start,report`   | M11 — `T-M11-006` |
| `POST` | `/api/v1/department/reports/{report}/progress`| `auth:sanctum` + `can:progress,report`| M11 — `T-M11-006` (no state change) |
| `POST` | `/api/v1/department/reports/{report}/resolve` | `auth:sanctum` + `can:resolve,report` | M11 — `T-M11-006` |
| `POST` | `/api/v1/department/reports/{report}/close`   | `auth:sanctum` + `can:close,report`   | M11 — `T-M11-006` |
| `POST` | `/api/v1/department/reports/{report}/note`    | `auth:sanctum` + `can:addNote,report` | M11 — `T-M11-005` (internal note) |
| `GET`  | `/api/v1/department/reports/{report}/notes`   | `auth:sanctum` + `can:view,report`    | M11 — `T-M11-005` (list notes) |
| `GET`  | `/api/v1/admin/departments/{department}/officers`     | `auth:sanctum` + super_admin | M11 — `T-M11-009` |
| `POST` | `/api/v1/admin/departments/{department}/officers`     | `auth:sanctum` + super_admin | M11 — `T-M11-009` |
| `DELETE` | `/api/v1/admin/departments/{department}/officers/{user}` | `auth:sanctum` + super_admin | M11 — `T-M11-009` |
| `PATCH` | `/api/v1/admin/departments/{department}/admin`       | `auth:sanctum` + super_admin | M11 — `T-M11-009` (SLA / hours / holidays / escalation) |

All routes are rate-limited via the `LIMITER_DEPARTMENT` (officer) or `LIMITER_ADMIN` (admin) buckets defined in `backend/app/Providers/RouteServiceProvider.php`.

### 1.2 Authorisation model

The M11 policy is `App\Modules\Departments\Policies\DepartmentPolicy`. It is **not** registered via `Gate::policy(Report::class, ...)` because the M10 moderator surface already owns that class binding — Laravel only allows one policy per class on the Gate. Instead the abilities are wired explicitly through `Gate::define()` in `DepartmentServiceProvider`:

```
Gate::define('viewDashboard', fn (User $u) => $policy->viewDashboard($u));
Gate::define('view',         fn (User $u, Report $r) => $policy->view($u, $r));
Gate::define('accept',       fn (User $u, Report $r) => $policy->accept($u, $r));
// …etc
```

The same provider also installs a `Gate::before()` callback that mirrors `BasePolicy::before()`:

- `super_admin` and `system` bypass every check.
- `suspended`, `disabled`, `pending` users are denied regardless of role.
- Soft-deleted users are denied.

This split keeps the M10 and M11 surfaces independent while still honoring the platform-wide bypass.

### 1.3 Services

| Service | Purpose | Tests |
| --- | --- | --- |
| `DepartmentReportService` | Drives the officer workflow (accept / start / progress / resolve / close + add note). Emits an `audit_logs` row and dispatches `ReportStatusChanged` for every transition. | `DepartmentReportServiceTest` |
| `DepartmentAdminService` | Manages the `department_users` pivot (attach / detach officer) and the per-department admin surface (SLA / working hours / holiday calendar / escalation matrix). | `AdminEndpointsTest` |
| `DepartmentReportsExport` | Builds the CSV / XLSX / PDF download for `/api/v1/department/reports/export`. | `ExportTest` |
| `DepartmentReportRepository` | Filters + pagination for the dashboard / list / export queries. | `DepartmentReportRepositoryTest` |

### 1.4 Database

The new M11 table is `report_internal_notes`:

```text
id              uuid PK
report_id       uuid  FK → reports.id
department_id   uuid  FK → departments.id
author_id       uuid  FK → users.id
body            text
created_at      timestamp
updated_at      timestamp
```

The pivot `department_users` is owned by M3 (T-M3-009) and is reused unchanged for the M11 attach / detach operations.

### 1.5 Migrations

`2026_06_29_110000_create_report_internal_notes_table.php` — the only M11 migration.

---

## 2. Frontend surface

### 2.1 Routing

`/operations*` is served by the `OperationsApp` mounted in `frontend/src/App.tsx`. The route table:

| Path | Component | Page |
| --- | --- | --- |
| `/operations`                   | `DashboardPage`        | live operational load + by-category breakdown |
| `/operations/reports`           | `ReportListPage`       | paginated, filterable, status-coded list |
| `/operations/reports/:id`       | `ReportDetailPage`     | lifecycle actions + internal notes |
| `/operations/reports/export`    | `ExportPage`           | CSV / XLSX / PDF download with current filters |
| `/operations/admin`             | `AdminPage`            | officer attach / detach, SLA, hours, holidays |

### 2.2 API client

`frontend/src/portals/operations/api/operations.ts` mirrors the backend surface 1-to-1. The shared `client.ts` (in the same folder) supports `get`, `post`, `put`, `patch`, `delete` and attaches the Sanctum bearer token from `localStorage.cip_token`.

### 2.3 State management

The portal uses `@tanstack/react-query` (provided by the top-level `QueryClientProvider` in `App.tsx`) for server state and React `useState` for ephemeral form state. No Redux, no Zustand — the surface is small enough to stay in the component tree.

### 2.4 Accessibility

Every page has a heading hierarchy (`h1` → `h2`), `aria-label` on the navigation, `aria-live="polite"` on loading / error states, and visible focus rings. The Playwright `operations.spec.ts` includes an axe-core WCAG 2.1 AA check on the dashboard.

---

## 3. OpenAPI

The M11 surface is documented in `backend/storage/api-docs/openapi.yaml` under two new tags:

- `Operations` — officer-facing endpoints (dashboard, list, lifecycle actions, internal notes, export)
- `Department Admin` — super-admin department sub-resources (officers, SLA, working hours, holiday calendar, escalation matrix)

The contract is enforced by `tests/Feature/Departments/OpenApiDepartmentTest.php` which asserts every path, schema, tag, path parameter, and the export format enum are present.

---

## 4. Tests

### 4.1 Backend

```bash
cd backend
vendor/bin/pest tests/Feature/Departments \
  tests/Feature/Departments/AdminEndpointsTest.php \
  tests/Feature/Departments/ExportTest.php \
  tests/Feature/Departments/OpenApiDepartmentTest.php
```

**50 backend tests** cover the M11 surface (endpoints + policy + repository + service + scope + migration + admin + export + OpenAPI).

### 4.2 Frontend

```bash
cd frontend
npm run build          # tsc --noEmit + vite build
npx vitest run         # design module + operations API client
npx playwright test    # E2E shell + a11y
```

---

## 5. Known follow-ups

- **Composer exporters.** The M11 task brief mentions `maatwebsite/excel` and `barryvdh/dompdf`. These packages are not yet in `composer.json`; the export endpoint produces CSV / SpreadsheetML 2003 / a minimal PDF 1.4 body with native PHP / Symfony primitives. Swap the implementation in `DepartmentReportsExport::xlsx()` / `DepartmentReportsExport::pdf()` to `Excel::download` / `PDF::loadView` once the packages are added. The wire contract (`?format=csv|xlsx|pdf`) is unchanged.
- **Department selector on the admin page.** The current `AdminPage` requires the user to paste a department id; production should fetch the officer's primary department from a `/me` endpoint and surface it as a read-only header. The placeholder text in the page covers the why.
- **Realtime updates.** Dashboard widgets use a 30 s `refetchInterval` for now. The M9 notification channel can push `report.department_action` events to invalidate the query keys in place.
