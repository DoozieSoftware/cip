# Integrations Module

## Purpose

Provides a configurable connector framework for external government APIs and third-party services. Every connector implements timeout, retry, audit, and health-check capabilities.

## Key Classes

| Class | Role |
|-------|------|
| `IntegrationAdminService` | CRUD operations and audited connector probe execution |
| `ProbeIntegrationHealthJob` | Asynchronous health probe with bounded retries |
| `IntegrationUrlGuard` | Public-address and optional production host allow-list boundary |
| `IntegrationRepository` | Persistence for connector records |
| `AdminIntegrationController` | Admin API for managing connectors |
| `Integration` | Connector configuration model |

## Connector Features

- Configurable base URL, authentication, timeout, retry count
- Asynchronous health check endpoint per connector
- Append-only probe results in `security_events` with correlation IDs
- Optional explicit production host allow-list (`CIP_INTEGRATION_PROBE_ALLOWED_HOSTS`)
- Request/response logging for audit
- Enable/disable toggle

Production defaults to fail-closed when the host allow-list is empty. Configure
only the approved upstream API hosts; do not add internal, wildcard-TLD, or
metadata endpoints. Network-level egress policy should independently restrict
the worker to those same public hosts.

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
