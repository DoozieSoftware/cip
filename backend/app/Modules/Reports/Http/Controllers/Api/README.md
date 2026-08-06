# Reports Http Controllers Api

## Purpose

Contains the API-facing controllers for the Reports module. These controllers handle citizen report submission, tracking, and staff report search/timeline. They are the HTTP entry point for the report aggregate.

## Controllers

| Controller | Responsibility |
|------------|----------------|
| `ReportsController` | Citizen submit, citizen dashboard, citizen report list/show, staff search, staff show, timeline |

## Notes

- All business logic resides in `ReportService`; controllers coordinate only.
- Citizen endpoints are rate-limited per `LIMITER_CITIZEN`.
- Staff search endpoints are rate-limited per `LIMITER_MODERATOR`.
- Report creation uses `SubmitReportDto` for input validation via `SubmitReportRequest`.
