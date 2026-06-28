# Notifications (M9)

The M9 notifications module is the platform's outbound
communication surface. Every state change that a
human (citizen, moderator, officer, super admin)
should be told about is delivered through this
module — push, email, SMS, or webhook.

It is defined end-to-end in `docs/02` §13, `docs/03` §17,
`docs/04` §13, `docs/05` §14, and `docs/11` §24.

## Channels

The `ChannelInterface` is the abstraction; every
concrete channel returns a `ChannelResult` (never
throws on transient failures) so the dispatcher
can decide whether to retry.

| Channel  | Class                | Driver                       | Notes                                            |
| -------- | -------------------- | ---------------------------- | ------------------------------------------------ |
| `log`    | `LogChannel`         | Laravel `Log`                | Dev / CI; writes to the `notifications` channel. |
| `email`  | `MailChannel`        | Laravel `Mail` + `Mailable`  | Resolves the recipient user + dispatches the `TemplateMailable`. |
| `push`   | `PushChannel`        | FCM HTTP v1 stub             | Reads `notifications.fcm.*` config; permanent on 4xx, transient on 5xx. |
| `sms`    | `SmsChannel`         | `SmsGatewayInterface`        | Delegates to the bound gateway (`LogSmsGateway` in V1, real provider in M14). |
| `webhook`| `WebhookChannel`     | Laravel `Http` client        | HMAC-SHA256 signed; `X-CIP-Signature: sha256=<hex>`. |

A channel is selected at dispatch time (per-template
default + caller override). The `SendNotificationJob`
picks the channel implementation by `notification.channel`.

## Templates

Templates live in `notification_templates` (UUID PK).
The unique key is `(code, locale, version)`. The
dispatcher looks up the active row for `(code, locale)`
and falls back to `en` if the requested locale has no
match. The highest `version` wins.

Variable grammar:

  - `{var_name}` — replaced with the value
  - `\{` and `\}` — literal braces (escape)
  - `null` renders as an empty string
  - arrays render as JSON

The default templates are seeded by
`NotificationTemplatesSeeder`:

  - `report.assigned` (email)
  - `report.assigned.sms` (sms)
  - `report.status_changed` (email)
  - `ai.classified` (email)
  - `ai.completed` (webhook — JSON body)
  - `security.alert` (email)

## Dispatcher

`NotificationDispatcher::dispatch(user, code, variables, locale?, overrides?)`:

  1. resolves the active template
  2. checks the per-(user, channel, event) preference
  3. if opted out, persists a `dead` row with `payload.reason = 'opted_out'`
  4. otherwise persists a `pending` row and dispatches `SendNotificationJob`

## Job (SendNotificationJob)

Queueable, `tries = 5`, backoff = `[60, 300, 900, 3600]` seconds
(1m, 5m, 15m, 60m), `timeout = 30s`. The job:

  - resolves the channel implementation
  - writes a `notification_logs` row per attempt
  - on success: marks the row `sent`
  - on transient failure: re-throws so the queue retries with backoff
  - after 5 attempts (or on permanent failure): marks the row `dead`
    and writes an `audit_logs` row with `action = notification.dead_letter`

## Event listeners

The Notifications module subscribes to four platform events:

| Event                       | Listener                          | Template dispatched      |
| --------------------------- | --------------------------------- | ------------------------ |
| `ReportAssigned`            | `ReportAssignedListener`          | `report.assigned`        |
| `ReportStatusChanged`       | `ReportStatusChangedListener`     | `report.status_changed`  |
| `AiCompleted`               | `NotificationsAiCompletedListener`| `ai.classified`          |
| `SecurityEvent`             | `SecurityEventListener`           | `security.alert`         |

All listeners tolerate missing reports / users (no
exception) and log but swallow dispatcher exceptions
so the originating event (assignment, status change,
AI result, security event) remains the source of truth.

## REST endpoints

| Method | Path                                       | Auth          | Notes                              |
| ------ | ------------------------------------------ | ------------- | ---------------------------------- |
| GET    | `/api/v1/notifications`                    | citizen       | paginated, filter `?unread=1 ?type=` |
| POST   | `/api/v1/notifications/{id}/read`          | citizen       | idempotent mark-as-read             |
| GET    | `/api/v1/notifications/preferences`        | citizen       | list own preferences                |
| PUT    | `/api/v1/notifications/preferences`        | citizen       | bulk-upsert (channel + event_code + enabled) |

## Preferences

`NotificationPreferenceService` is the gate. The
dispatcher asks `isEnabled(user, channel, event_code)`
before creating a `pending` row. Absence = platform
default (opt-in for V1). Presence = explicit value.

## OpenAPI

The four endpoints + their schemas (`Notification`,
`NotificationListResponse`, `NotificationReadResponse`,
`NotificationPreference`, `NotificationPreferenceBulkUpdate`,
`NotificationPreferenceListResponse`) are documented in
`storage/api-docs/openapi.yaml` under the `Notifications`
tag. Re-validated by
`tests/Feature/Notifications/OpenApiNotificationsTest.php`.

## Module layout

```
backend/app/Modules/Notifications/
├── Channels/         # LogChannel, MailChannel, PushChannel, SmsChannel, WebhookChannel
├── Contracts/        # ChannelInterface, SmsGatewayInterface
├── Drivers/          # LogSmsGateway
├── Exceptions/       # TemplateNotFoundException, MissingTemplateVariableException
├── Http/
│   ├── Controllers/Api/   # NotificationsController, NotificationPreferenceController
│   └── Resources/         # NotificationResource
├── Jobs/             # SendNotificationJob
├── Listeners/        # ReportAssignedListener, ReportStatusChangedListener, ...
├── Mail/             # TemplateMailable
├── Models/           # Notification, NotificationLog, NotificationTemplate, NotificationPreference
├── Providers/        # NotificationsServiceProvider
├── Services/         # TemplateEngine, NotificationDispatcher, NotificationPreferenceService
└── ValueObjects/     # ChannelResult
```
