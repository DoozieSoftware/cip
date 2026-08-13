# Moderation Module

## Purpose

Provides the moderation queue and actions for reviewing AI-processed reports. Moderators approve, reject, merge duplicates, escalate, and override AI department recommendations.

## Key Classes

| Class | Role |
|-------|------|
| `ModerationService` | Business logic for review actions |
| `ModerationAnalyticsService` | Aggregated moderation metrics |
| `QueueController` | Review, duplicate, and misrepresentation queues |
| `ModerationActionsController` | Review, merge, reject, escalate actions |
| `AnalyticsController` | Moderation analytics endpoints |
| `ModerationPolicy` | Authorization rules |
| `ReviewReportDto` | Input DTO for review actions |

## Events

- `ReportModerated` — emitted when a moderator takes action
- `ReportsMerged` — emitted when duplicate reports are merged

## Dependencies

- `Reports` (Report model, assignments)
- `AI` (AI results for review display)
- `Departments` (department override on approval)
- `Shared` (BaseController, ApiResponse)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/moderator/queue` | `api.v1.moderator.queue` |
| GET | `/api/v1/moderator/duplicates` | `api.v1.moderator.duplicates` |
| GET | `/api/v1/moderator/misrepresentation` | `api.v1.moderator.misrepresentation` |
| GET | `/api/v1/moderator/fraud` | `api.v1.moderator.fraud` compatibility alias |
| GET | `/api/v1/moderator/departments` | `api.v1.moderator.departments.index` |
| GET | `/api/v1/moderator/reports/{report}` | `api.v1.moderator.reports.show` |
| GET | `/api/v1/moderator/analytics/summary` | `api.v1.moderator.analytics.summary` |
| GET | `/api/v1/moderator/analytics/ai-performance` | `api.v1.moderator.analytics.ai-performance` |
| POST | `/api/v1/moderator/reports/{report}/review` | `api.v1.moderator.reports.review` |
| POST | `/api/v1/moderator/reports/{report}/merge` | `api.v1.moderator.reports.merge` |
| POST | `/api/v1/moderator/reports/{report}/reject` | `api.v1.moderator.reports.reject` |
| POST | `/api/v1/moderator/reports/{report}/escalate` | `api.v1.moderator.reports.escalate` |
