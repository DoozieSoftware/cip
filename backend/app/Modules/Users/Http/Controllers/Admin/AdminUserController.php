<?php

declare(strict_types=1);

namespace App\Modules\Users\Http\Controllers\Admin;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Http\Requests\Admin\StoreUserRequest;
use App\Modules\Users\Http\Requests\Admin\UpdateUserRequest;
use App\Modules\Users\Http\Resources\UserResource;
use App\Modules\Users\Models\User;
use App\Modules\Users\Repositories\UserRepository;
use App\Modules\Users\Services\AdminUserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M12-001 — Super Admin user CRUD per `docs/05` §10 and `docs/09` §8.
 *
 *  - GET    /api/v1/admin/users
 *  - POST   /api/v1/admin/users
 *  - GET    /api/v1/admin/users/{user}
 *  - PUT    /api/v1/admin/users/{user}
 *  - DELETE /api/v1/admin/users/{user}   (soft delete)
 *  - POST   /api/v1/admin/users/{user}/restore
 *
 * The super_admin / system role gate is on each Form Request's
 * authorize() and on a secondary `ensureAdmin` call on read
 * endpoints. All writes go through `AdminUserService` so the
 * audit pipeline receives the lifecycle events.
 */
class AdminUserController extends BaseController
{
    public function __construct(
        private readonly UserRepository $repository,
        private readonly AdminUserService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $filters = [
            'q' => $request->query('q'),
            'role' => $request->query('role'),
            'status' => $request->query('status'),
            'department_id' => $request->query('department_id'),
            'include_trashed' => filter_var($request->query('include_trashed'), FILTER_VALIDATE_BOOLEAN),
            'only_trashed' => filter_var($request->query('only_trashed'), FILTER_VALIDATE_BOOLEAN),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $page = $this->repository->search($filters, (int) $request->query('per_page', 25));
        $transformed = $page->through(static fn (User $u): array => (new UserResource($u))->toArray($request));

        return $this->respondPaginated($transformed);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->service->create($request->validated());

        return $this->respond(
            (new UserResource($user))->toArray($request),
            'User created.',
            201,
        );
    }

    public function show(Request $request, string $user): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findUser($user, withTrashed: true);

        return $this->respond((new UserResource($model))->toArray($request));
    }

    public function update(UpdateUserRequest $request, string $user): JsonResponse
    {
        $model = $this->findUser($user);
        $updated = $this->service->update($model, $request->validated());

        return $this->respond((new UserResource($updated))->toArray($request), 'User updated.');
    }

    public function destroy(Request $request, string $user): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findUser($user);
        $this->service->delete($model);

        return $this->respond(null, 'User deleted.', 200);
    }

    public function restore(Request $request, string $user): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findUser($user, withTrashed: true);

        if ($model->deleted_at === null) {
            return $this->respond((new UserResource($model))->toArray($request), 'User was not deleted.');
        }
        $restored = $this->service->restore($model);

        return $this->respond((new UserResource($restored))->toArray($request), 'User restored.');
    }

    private function findUser(string $id, bool $withTrashed = false): User
    {
        $query = $withTrashed ? User::query()->withTrashed() : User::query();
        $user = $query->where('id', $id)->first();

        if ($user === null) {
            throw ApiException::notFound('User');
        }

        return $user;
    }
}
