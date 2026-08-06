# Notifications Module

## Purpose

Delivers notifications across multiple channels (push, email, SMS, webhook, log). Supports user preferences, channel configuration, and delivery tracking. Uses a pluggable channel interface.

## Key Classes

| Class | Role |
|-------|------|
| `NotificationDispatcher` | Routes notifications to configured channels |
| `NotificationChannelConfigService` | Manages channel configuration |
| `NotificationPreferenceService` | Per-user channel preferences |
| `TemplateEngine` | Renders notification content from templates |
| `SendNotificationJob` | Async delivery job |
| `ChannelInterface` | Contract for all delivery channels |
| `NotificationsController` | Inbox listing and read marking |
| `PushSubscriptionController` | Web Push subscription management |
| `NotificationPreferenceController` | Preference read/update |

## Channels

- `PushChannel` — Web Push (VAPID)
- `MailChannel` — Email via Laravel Mail
- `SmsChannel` — SMS via configurable gateway
- `WebhookChannel` — Outgoing webhook delivery
- `LogChannel` — Log-only (for testing)

## SMS Gateways

- `LogSmsGateway` — logs instead of sending (default/development)
- Additional gateways implement `SmsGatewayInterface`

## Models

- `Notification` — pending notification records
- `NotificationLog` — immutable delivery history
- `NotificationChannelConfig` — per-channel configuration

## Dependencies

- `Users` (User model, preferences)
- `Shared` (BaseController, ApiResponse)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/notifications` | `notifications.index` |
| POST | `/api/v1/notifications/{id}/read` | `notifications.read` |
| GET | `/api/v1/notifications/preferences` | `notifications.preferences.index` |
| PUT | `/api/v1/notifications/preferences` | `notifications.preferences.update` |
| GET | `/api/v1/notifications/push/vapid-public-key` | `notifications.push.vapid` |
| POST | `/api/v1/notifications/push/subscriptions` | `notifications.push.store` |
| DELETE | `/api/v1/notifications/push/subscriptions` | `notifications.push.destroy` |
| GET | `/api/v1/admin/notification-configs` | `api.v1.admin.notification-configs.index` |
| POST | `/api/v1/admin/notification-configs` | `api.v1.admin.notification-configs.store` |
| PUT | `/api/v1/admin/notification-configs/{config}` | `api.v1.admin.notification-configs.update` |
| DELETE | `/api/v1/admin/notification-configs/{config}` | `api.v1.admin.notification-configs.destroy` |
