# Integrations Module

## Purpose

Provides a configurable connector framework for external government APIs and third-party services. Every connector implements timeout, retry, audit, and health-check capabilities.

## Key Classes

| Class | Role |
|-------|------|
| `IntegrationAdminService` | CRUD operations for connector configuration |
| `IntegrationRepository` | Persistence for connector records |
| `AdminIntegrationController` | Admin API for managing connectors |
| `Integration` | Connector configuration model |

## Connector Features

- Configurable base URL, authentication, timeout, retry count
- Health check endpoint per connector
- Request/response logging for audit
- Enable/disable toggle

## Dependencies

- `Shared` (BaseController, ApiResponse)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/admin/integrations` | `api.v1.admin.integrations.index` |
| POST | `/api/v1/admin/integrations` | `api.v1.admin.integrations.store` |
| GET | `/api/v1/admin/integrations/{integration}` | `api.v1.admin.integrations.show` |
| PUT | `/api/v1/admin/integrations/{integration}` | `api.v1.admin.integrations.update` |
| DELETE | `/api/v1/admin/integrations/{integration}` | `api.v1.admin.integrations.destroy` |
| POST | `/api/v1/admin/integrations/{integration}/restore` | `api.v1.admin.integrations.restore` |
| POST | `/api/v1/admin/integrations/{integration}/health` | `api.v1.admin.integrations.health` |
