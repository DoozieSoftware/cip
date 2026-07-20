<?php

declare(strict_types=1);

namespace App\Modules\Security\Http\Controllers\Admin;

use App\Modules\Security\Http\Requests\Admin\UpsertSecurityPolicyRequest;
use App\Modules\Security\Http\Resources\SecurityPolicyResource;
use App\Modules\Security\Models\SecurityPolicy;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M12-010 — Super Admin security policy CRUD per `docs/09` §19.
 *
 *  - GET    /api/v1/admin/security-policies
 *  - POST   /api/v1/admin/security-policies            (upsert by `key`)
 *  - GET    /api/v1/admin/security-policies/{key}
 *  - PUT    /api/v1/admin/security-policies/{key}      (upsert by `key`)
 *  - DELETE /api/v1/admin/security-policies/{key}
 *
 * The model is intentionally small — one row per policy
 * `key` — so the Super Admin screen can render the full
 * catalogue and edit each value in place. New policies
 * are added by writing a new key; no schema change.
 */
class AdminSecurityPolicyController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $q = SecurityPolicy::query();

        if ($search = $request->query('q')) {
            $needle = '%'.$search.'%';
            $q->where(static function ($w) use ($needle): void {
                $w->where('key', 'like', $needle)
                    ->orWhere('description', 'like', $needle);
            });
        }
        $perPage = $this->perPage($request, 50, 200);
        $page = $q->orderBy('key')->paginate($perPage);
        $transformed = $page->through(static fn (SecurityPolicy $p): array => (new SecurityPolicyResource($p))->toArray($request));

        return $this->respondPaginated($transformed);
    }

    public function store(UpsertSecurityPolicyRequest $request): JsonResponse
    {
        $policy = SecurityPolicy::query()->updateOrCreate(
            ['key' => $request->validated()['key']],
            $request->validated(),
        );

        return $this->respond(
            (new SecurityPolicyResource($policy))->toArray($request),
            'Security policy saved.',
            201,
        );
    }

    public function show(Request $request, string $key): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findByKey($key);

        return $this->respond((new SecurityPolicyResource($model))->toArray($request));
    }

    public function update(UpsertSecurityPolicyRequest $request, string $key): JsonResponse
    {
        $model = $this->findByKey($key);
        $data = $request->validated();
        unset($data['key']);
        $model->fill($data);
        $model->save();

        return $this->respond(
            (new SecurityPolicyResource($model))->toArray($request),
            'Security policy updated.',
        );
    }

    public function destroy(Request $request, string $key): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findByKey($key);
        $model->delete();

        return $this->respond(null, 'Security policy deleted.', 200);
    }

    private function findByKey(string $key): SecurityPolicy
    {
        $model = SecurityPolicy::query()->where('key', $key)->first();

        if ($model === null) {
            throw ApiException::notFound('Security policy');
        }

        return $model;
    }
}
