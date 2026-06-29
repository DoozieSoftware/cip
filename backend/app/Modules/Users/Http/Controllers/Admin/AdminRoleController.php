<?php

declare(strict_types=1);

namespace App\Modules\Users\Http\Controllers\Admin;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * T-M12-002 — Super Admin role CRUD per `docs/09` §9.
 *
 *  - GET    /api/v1/admin/roles
 *  - POST   /api/v1/admin/roles
 *  - GET    /api/v1/admin/roles/{role}
 *  - PUT    /api/v1/admin/roles/{role}
 *  - DELETE /api/v1/admin/roles/{role}
 *  - POST   /api/v1/admin/roles/{role}/permissions/sync
 *
 * `super_admin` and `system` are protected and cannot be
 * deleted through this surface; renaming them is allowed but
 * the protected list is enforced on every write.
 */
class AdminRoleController extends BaseController
{
    private const PROTECTED_ROLES = ['super_admin', 'system'];

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $q = Role::query()->with('permissions');
        if ($search = $request->query('q')) {
            $q->where('name', 'like', '%' . $search . '%');
        }
        $perPage = max(1, min(200, (int) $request->query('per_page', 25)));
        $page = $q->orderBy('name')->paginate($perPage);
        $transformed = $page->through(static fn (Role $role): array => [
            'id' => $role->id,
            'name' => $role->name,
            'guard_name' => $role->guard_name,
            'protected' => in_array($role->name, self::PROTECTED_ROLES, true),
            'permissions' => $role->permissions->pluck('name')->values()->all(),
            'created_at' => $role->created_at?->toIso8601String(),
        ]);

        return $this->respondPaginated($transformed);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $data = $this->validatePayload($request);

        $role = Role::firstOrCreate(
            ['name' => $data['name'], 'guard_name' => $data['guard_name']],
        );

        if (! empty($data['permissions'])) {
            $this->syncPermissions($role, $data['permissions']);
        }

        return $this->respond($this->serialize($role), 'Role created.', 201);
    }

    public function show(Request $request, string $role): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findRole($role);

        return $this->respond($this->serialize($model));
    }

    public function update(Request $request, string $role): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findRole($role);
        $data = $this->validatePayload($request, partial: true);

        if (array_key_exists('name', $data) && $data['name'] !== $model->name
            && in_array($model->name, self::PROTECTED_ROLES, true)) {
            throw ApiException::forbidden('Protected role names cannot be changed.');
        }
        if (array_key_exists('name', $data)) {
            $model->name = $data['name'];
        }
        if (array_key_exists('guard_name', $data)) {
            $model->guard_name = $data['guard_name'];
        }
        $model->save();

        if (! empty($data['permissions'])) {
            $this->syncPermissions($model, $data['permissions']);
        }

        return $this->respond($this->serialize($model->fresh(['permissions'])), 'Role updated.');
    }

    public function destroy(Request $request, string $role): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findRole($role);

        if (in_array($model->name, self::PROTECTED_ROLES, true)) {
            throw ApiException::forbidden('Protected role cannot be deleted.');
        }
        $model->delete();

        return $this->respond(null, 'Role deleted.', 200);
    }

    /**
     * POST /api/v1/admin/roles/{role}/permissions/sync
     * Body: { "permissions": ["reports.view", "reports.review"] }
     */
    public function syncPermissionsEndpoint(Request $request, string $role): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findRole($role);

        $payload = $request->validate([
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string', 'max:128'],
        ]);

        $this->syncPermissions($model, $payload['permissions']);

        return $this->respond($this->serialize($model->fresh(['permissions'])), 'Permissions synced.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, bool $partial = false): array
    {
        $rules = [
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:64'],
            'guard_name' => ['nullable', 'string', 'max:64'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:128'],
        ];

        $data = $request->validate($rules);
        $data['guard_name'] = $data['guard_name'] ?? 'web';

        return $data;
    }

    /**
     * @param  list<string>  $permissionNames
     */
    private function syncPermissions(Role $role, array $permissionNames): void
    {
        $existing = Permission::query()
            ->whereIn('name', $permissionNames)
            ->where('guard_name', $role->guard_name)
            ->pluck('name')
            ->all();
        $missing = array_values(array_diff($permissionNames, $existing));
        if ($missing !== []) {
            throw new ApiException(
                'UNKNOWN_PERMISSIONS',
                'One or more permission names do not exist on guard ' . $role->guard_name . ': ' . implode(', ', $missing),
                422,
                ['missing' => $missing],
            );
        }
        $role->syncPermissions($existing);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Role $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'guard_name' => $role->guard_name,
            'protected' => in_array($role->name, self::PROTECTED_ROLES, true),
            'permissions' => $role->relationLoaded('permissions')
                ? $role->permissions->pluck('name')->values()->all()
                : $role->permissions()->pluck('name')->all(),
            'created_at' => $role->created_at?->toIso8601String(),
        ];
    }

    private function findRole(string $id): Role
    {
        $role = is_numeric($id)
            ? Role::query()->where('id', (int) $id)->first()
            : Role::query()->where('name', $id)->first();
        if ($role === null) {
            throw ApiException::notFound('Role');
        }

        return $role;
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! method_exists($user, 'hasRole') || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
