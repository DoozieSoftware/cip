# Settings Module

## Purpose

Manages global application settings and feature flags. Provides key/value storage for configuration and boolean/toggle feature flags for gradual rollout.

## Key Classes

| Class | Role |
|-------|------|
| `SettingsService` | CRUD for key/value settings |
| `FeatureFlagService` | Feature flag evaluation and management |
| `SettingController` | Settings admin endpoints |
| `AppConfigController` | Feature flag admin endpoints |
| `RetentionHoldService` | Validated legal hold lifecycle, duplicate prevention, and release custody |
| `RetentionHoldController` | Super-admin legal hold list/create/release endpoints |
| `PurgeRetentionCommand` | Console command for data retention purging |

## Models

- `Setting` — key/value configuration pairs
- `AppConfig` — feature flag definitions with evaluation rules
- `RetentionHold` — append-preserving legal holds with actor, expiry, and release custody fields

## Dependencies

- `Shared` (BaseController, ApiResponse)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/admin/settings` | `api.v1.admin.settings.index` |
| POST | `/api/v1/admin/settings` | `api.v1.admin.settings.store` |
| GET | `/api/v1/admin/settings/{setting}` | `api.v1.admin.settings.show` |
| PUT | `/api/v1/admin/settings/{setting}` | `api.v1.admin.settings.update` |
| DELETE | `/api/v1/admin/settings/{setting}` | `api.v1.admin.settings.destroy` |
| GET | `/api/v1/admin/retention-holds` | `api.v1.admin.retention-holds.index` |
| POST | `/api/v1/admin/retention-holds` | `api.v1.admin.retention-holds.store` |
| POST | `/api/v1/admin/retention-holds/{retention_hold}/release` | `api.v1.admin.retention-holds.release` |
| GET | `/api/v1/admin/app-configs` | `api.v1.admin.app-configs.index` |
| POST | `/api/v1/admin/app-configs` | `api.v1.admin.app-configs.store` |
| GET | `/api/v1/admin/app-configs/{app_config}` | `api.v1.admin.app-configs.show` |
| GET | `/api/v1/admin/app-configs/{app_config}/evaluate` | `api.v1.admin.app-configs.evaluate` |
| PUT | `/api/v1/admin/app-configs/{app_config}` | `api.v1.admin.app-configs.update` |
| DELETE | `/api/v1/admin/app-configs/{app_config}` | `api.v1.admin.app-configs.destroy` |
