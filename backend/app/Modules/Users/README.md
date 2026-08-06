# Users Module

## Purpose

Manages user accounts, roles, and permissions. Provides admin CRUD for users, role management, and permission directory. Integrates with Spatie Permission for RBAC.

## Key Classes

| Class | Role |
|-------|------|
| `AdminUserService` | User CRUD operations |
| `RoleService` | Role and permission management |
| `UserRepository` | User persistence and queries |
| `AdminUserController` | User admin endpoints |
| `AdminRoleController` | Role admin endpoints |
| `AdminPermissionController` | Permission directory endpoints |

## Models

- `User` — authenticated user accounts (citizens, moderators, officers, admins)
- `DepartmentUserPivot` — officer-department membership

## Events

- `UserCreated` / `UserUpdated` / `UserDeleted` — lifecycle events
- `UserRoleChanged` — role assignment change
- `UserPermissionChanged` — direct permission grant/revoke

## Dependencies

- `Shared` (BaseController, ApiResponse)
- `Departments` (via pivot table)

## API Endpoints

| Method | Path | Name |
|--------|------|------|
| GET | `/api/v1/admin/users` | `api.v1.admin.users.index` |
| POST | `/api/v1/admin/users` | `api.v1.admin.users.store` |
| GET | `/api/v1/admin/users/{user}` | `api.v1.admin.users.show` |
| PUT | `/api/v1/admin/users/{user}` | `api.v1.admin.users.update` |
| DELETE | `/api/v1/admin/users/{user}` | `api.v1.admin.users.destroy` |
| POST | `/api/v1/admin/users/{user}/restore` | `api.v1.admin.users.restore` |
| GET | `/api/v1/admin/roles` | `api.v1.admin.roles.index` |
| POST | `/api/v1/admin/roles` | `api.v1.admin.roles.store` |
| GET | `/api/v1/admin/roles/{role}` | `api.v1.admin.roles.show` |
| PUT | `/api/v1/admin/roles/{role}` | `api.v1.admin.roles.update` |
| DELETE | `/api/v1/admin/roles/{role}` | `api.v1.admin.roles.destroy` |
| POST | `/api/v1/admin/roles/{role}/permissions/sync` | `api.v1.admin.roles.permissions.sync` |
| GET | `/api/v1/admin/permissions` | `api.v1.admin.permissions.index` |
| POST | `/api/v1/admin/permissions` | `api.v1.admin.permissions.store` |
| GET | `/api/v1/admin/permissions/{permission}` | `api.v1.admin.permissions.show` |
| DELETE | `/api/v1/admin/permissions/{permission}` | `api.v1.admin.permissions.destroy` |
