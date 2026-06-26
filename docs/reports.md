# Reports API (M4)

The Reports API is the citizen-facing write path and the staff-facing
read path for the platform's `reports` table. It is defined end-to-end
in `docs/05` §6, §7, §15-16, §20, §22, §23 and `docs/09` §7.

## Endpoints

| Method | Path                                       | Audience            | Notes                       |
| ------ | ------------------------------------------ | ------------------- | --------------------------- |
| POST   | `/api/v1/reports`                          | Citizen             | Create + submit in one step |
| POST   | `/api/v1/reports/{id}/submit`              | Citizen / Staff     | 2-step submit of a draft    |
| GET    | `/api/v1/reports`                          | Moderator / Staff   | Paginated staff search      |
| GET    | `/api/v1/reports/{id}`                     | Moderator / Staff   | Single report read          |
| GET    | `/api/v1/reports/{id}/timeline`            | Moderator / Staff   | Status transition history   |
| GET    | `/api/v1/citizen/dashboard`                | Citizen             | Aggregate counts            |
| GET    | `/api/v1/citizen/reports`                  | Citizen             | Own reports (paginated)     |
| GET    | `/api/v1/citizen/reports/{id}`             | Citizen / Staff     | Own report detail           |

## Wire shape

The submit payload is `SubmitReportRequest` (see `docs/05` §6). All
GPS-related fields are validated by the `LocationAccuracy` rule
(<= 100m). Speed sanity (0..200 m/s) is enforced on the service side
via `LocationService::assertSpeed()`.

## Tracking number

Every report gets a `tracking_number` of the form `CIV-YYYY-NNNNNN`
on the create path. The 6-digit suffix is a per-year counter; the
DB-side `unique` constraint is the safety net against races.

## Status history

Every transition appends an immutable row to `report_status_history`
via the `ReportStatusChanged` event + `WriteStatusHistory` listener
wired in `AppServiceProvider::boot()`. Updates and deletes on the
table are blocked at the model level.

## Authorization

The `ReportPolicy` and `LocationPolicy` are the source of truth for
who can read/write a report. `BasePolicy::before()` short-circuits
to deny suspended/disabled/pending users and to allow super_admin /
system. Per-ability rules:

- `view` — owner or any staff role
- `update` — owner (only on draft) or any staff role
- `delete` — staff only
- `review` / `assign` — moderator / super_admin only
- `resolve` — moderator / department / super_admin
- `export` — super_admin only

## Idempotency

Mutating endpoints respect the `Idempotency-Key` header (T-M4-020).
A replay with the same `(key, user_id, request_hash)` returns the
stored response. A key reuse with a different payload returns 409
`IDEMPOTENCY_KEY_CONFLICT`.

## Error codes

`docs/05` §23 is implemented in `App\Modules\Shared\Enums\ErrorCode`.
The Reports-specific codes are `REPORT_NOT_FOUND`, `INVALID_GPS`,
`INVALID_GPS_LOW_ACCURACY`, `IMPOSSIBLE_SPEED`, `VIDEO_REQUIRED`,
`PHOTO_REQUIRED`, `DUPLICATE_REPORT`, `INVALID_STATUS`,
`MISSING_REFERENCE_DATA`.

## OpenAPI

The Reports paths + component schemas are in
`backend/storage/api-docs/openapi.yaml` under the `Reports` tag.
The Swagger UI is served at `/api/documentation`.
