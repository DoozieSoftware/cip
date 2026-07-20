<?php

declare(strict_types=1);

namespace App\Modules\Users\Http\Controllers\Admin;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;

/**
 * T-M12-002 — Super Admin permission directory.
 *
 * Per `docs/09` §9 the Super Admin needs a searchable list of
 * every permission in the system so the role-permission matrix
 * screen can render. Writes are intentionally not exposed
 * here — new permissions are created via the seeders
 * (`RolesAndPermissionsSeeder`) and via `AdminRoleController`'s
 * sync endpoint, which keeps the permission catalogue in a
 * single, code-reviewable source of truth.
 *
 *  - GET    /api/v1/admin/permissions
 *  - GET    /api/v1/admin/permissions/{permission}
 *  - POST   /api/v1/admin/permissions            (seed-driven)
 *  - DELETE /api/v1/admin/permissions/{permission}
 */
class AdminPermissionController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $q = Permission::query();

        if ($search = $request->query('q')) {
            $q->where('name', 'like', '%'.$search.'%');
        }
        $guard = $request->query('guard_name');

        if (is_string($guard) && $guard !== '') {
            $q->where('guard_name', $guard);
        }
        $perPage = $this->perPage($request, 50, 200);
        $page = $q->orderBy('name')->paginate($perPage);
        $transformed = $page->through(static fn (Permission $p): array => [
            'id' => $p->id,
            'name' => $p->name,
            'guard_name' => $p->guard_name,
            'created_at' => $p->created_at?->toIso8601String(),
        ]);

        return $this->respondPaginated($transformed);
    }

    public function show(Request $request, string $permission): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findPermission($permission);

        return $this->respond($this->serialize($model));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:128'],
            'guard_name' => ['nullable', 'string', 'max:64'],
        ]);
        $data['guard_name'] = $data['guard_name'] ?? 'web';

        $perm = Permission::firstOrCreate(
            ['name' => $data['name'], 'guard_name' => $data['guard_name']],
        );

        return $this->respond($this->serialize($perm), 'Permission created.', 201);
    }

    public function destroy(Request $request, string $permission): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findPermission($permission);
        $model->delete();

        return $this->respond(null, 'Permission deleted.', 200);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Permission $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'guard_name' => $p->guard_name,
            'created_at' => $p->created_at?->toIso8601String(),
        ];
    }

    private function findPermission(string $id): Permission
    {
        $perm = is_numeric($id)
            ? Permission::query()->where('id', (int) $id)->first()
            : Permission::query()->where('name', $id)->first();

        if ($perm === null) {
            throw ApiException::notFound('Permission');
        }

        return $perm;
    }
}
