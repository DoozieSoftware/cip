<?php

declare(strict_types=1);

namespace App\Modules\Users\Services;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Services\BaseService;
use App\Modules\Users\Events\UserPermissionChanged;
use App\Modules\Users\Events\UserRoleChanged;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Authoritative role / permission management.
 *
 * Per docs/03 §14 (Authorization) and docs/11 §9. The Spatie
 * Permission package gives us `assignRole`, `removeRole`, and
 * `givePermissionTo` on the model; this service is the *only*
 * path through which the application mutates role membership, so
 * that:
 *
 *  - role names are validated against the baseline (no typos)
 *  - permission grants stay idempotent and observable
 *  - every mutation emits an `Event` so the audit pipeline can
 *    record it (M2-Audit-Middleware)
 *
 * Idempotency:
 *  - `assign` is a no-op when the user already has the role
 *  - `revoke` is a no-op when the user does not have the role
 *  - `grantPermission` / `revokePermission` follow the same rule
 */
class RoleService extends BaseService
{
    /**
     * Roles that cannot be assigned or revoked through this service.
     * The list is intentionally short — super_admin / system should
     * only be granted via the Super Admin Portal (M12) under stricter
     * controls (2FA, dual approval, audit trail).
     */
    private const PROTECTED_ROLES = ['super_admin', 'system'];

    /**
     * @throws ApiException 422 if the role does not exist
     */
    public function assign(User $user, string $role, ?string $guardName = 'web'): User
    {
        return DB::transaction(function () use ($user, $role, $guardName): User {
            $roleModel = $this->resolveRole($role, $guardName);

            if ($user->hasRole($role)) {
                return $user;
            }

            $user->assignRole($roleModel);
            $this->emitRoleChanged($user, $role, 'assigned');

            return $user->refresh()->load('roles');
        });
    }

    /**
     * @throws ApiException 422 if the role does not exist
     */
    public function revoke(User $user, string $role, ?string $guardName = 'web'): User
    {
        return DB::transaction(function () use ($user, $role, $guardName): User {
            $this->resolveRole($role, $guardName);

            if (! $user->hasRole($role)) {
                return $user;
            }

            if (in_array($role, self::PROTECTED_ROLES, true)) {
                throw new ApiException(
                    'ROLE_PROTECTED',
                    "Role '{$role}' is protected and cannot be revoked via this service.",
                    422,
                );
            }

            $user->removeRole($role);
            $this->emitRoleChanged($user, $role, 'revoked');

            return $user->refresh()->load('roles');
        });
    }

    public function hasRole(User $user, string $role): bool
    {
        return $user->hasRole($role);
    }

    /**
     * @param  list<string>  $roles
     */
    public function hasAnyRole(User $user, array $roles): bool
    {
        /** @var list<string> $roles */
        return $user->hasAnyRole($roles);
    }

    public function hasPermission(User $user, string $permission): bool
    {
        return $user->can($permission);
    }

    /**
     * @param  list<string>  $permissions
     */
    public function hasAnyPermission(User $user, array $permissions): bool
    {
        /** @var list<string> $permissions */
        foreach ($permissions as $permission) {
            if ($user->can($permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @throws ApiException 422 if the role does not exist
     */
    public function grantPermission(User $user, string $permission, ?string $guardName = 'web'): User
    {
        return DB::transaction(function () use ($user, $permission, $guardName): User {
            $this->resolveRoleOrPermission($permission, $guardName);

            if ($user->can($permission)) {
                return $user;
            }

            $user->givePermissionTo($permission);
            $this->emitPermissionChanged($user, $permission, 'granted');

            return $user->refresh()->load('permissions');
        });
    }

    /**
     * @throws ApiException 422 if the role does not exist
     */
    public function revokePermission(User $user, string $permission, ?string $guardName = 'web'): User
    {
        return DB::transaction(function () use ($user, $permission, $guardName): User {
            $this->resolveRoleOrPermission($permission, $guardName);

            if (! $user->can($permission)) {
                return $user;
            }

            $user->revokePermissionTo($permission);
            $this->emitPermissionChanged($user, $permission, 'revoked');

            return $user->refresh()->load('permissions');
        });
    }

    /**
     * @return list<string>
     */
    public function permissionsFor(User $user): array
    {
        /** @var list<string> */
        return array_values($user->getAllPermissions()->pluck('name')->all());
    }

    /**
     * @return list<string>
     */
    public function rolesFor(User $user): array
    {
        /** @var list<string> */
        return array_values($user->roles->pluck('name')->all());
    }

    private function resolveRole(string $name, ?string $guardName): Role
    {
        $role = Role::query()
            ->where('name', $name)
            ->when($guardName !== null, fn ($q) => $q->where('guard_name', $guardName))
            ->first();

        if ($role === null) {
            throw new ApiException(
                'ROLE_NOT_FOUND',
                "Role '{$name}' does not exist.",
                422,
            );
        }

        return $role;
    }

    private function resolveRoleOrPermission(string $name, ?string $guardName): void
    {
        $exists = Role::query()->where('name', $name)->exists()
            || Permission::query()->where('name', $name)->exists();

        if (! $exists) {
            throw new ApiException(
                'ROLE_OR_PERMISSION_NOT_FOUND',
                "Role or permission '{$name}' does not exist.",
                422,
            );
        }
    }

    private function emitRoleChanged(User $user, string $role, string $action): void
    {
        $this->emit(new UserRoleChanged(
            userId: $user->id,
            role: $role,
            action: $action,
        ));
    }

    private function emitPermissionChanged(User $user, string $permission, string $action): void
    {
        $this->emit(new UserPermissionChanged(
            userId: $user->id,
            permission: $permission,
            action: $action,
        ));
    }
}
