<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Controllers\Admin;

use App\Modules\Settings\Http\Requests\StoreAppConfigRequest;
use App\Modules\Settings\Http\Requests\UpdateAppConfigRequest;
use App\Modules\Settings\Http\Resources\AppConfigResource;
use App\Modules\Settings\Models\AppConfig;
use App\Modules\Settings\Services\FeatureFlagService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super Admin CRUD for `app_configs` (feature flags) per
 * docs/05 §10 and docs/09 §18.
 *
 *  - GET    /api/v1/admin/app-configs
 *  - POST   /api/v1/admin/app-configs
 *  - GET    /api/v1/admin/app-configs/{app_config}
 *  - PUT    /api/v1/admin/app-configs/{app_config}
 *  - DELETE /api/v1/admin/app-configs/{app_config}
 *  - GET    /api/v1/admin/app-configs/{app_config}/evaluate?user_id=&session_id=
 *
 * The path parameter is the flag's `key` (e.g.
 * `ai.vision.enabled`) — that is the natural primary handle
 * for a feature flag and is what `FeatureFlagService::enabled`
 * consumes.
 *
 * The `super_admin` role gate is on each Form Request's
 * `authorize()`; index/show/destroy/evaluate double-check it
 * defensively.
 */
class AppConfigController extends BaseController
{
    public function __construct(
        private readonly FeatureFlagService $flags,
    ) {}

    /**
     * GET /api/v1/admin/app-configs
     */
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $perPage = (int) $request->query('per_page', 25);
        $perPage = $perPage > 0 ? min($perPage, 200) : 25;
        $q = $request->query('q');
        $enabledOnly = filter_var($request->query('enabled'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        return $this->respondPaginated($this->paginate($q, $enabledOnly, $perPage));
    }

    /**
     * POST /api/v1/admin/app-configs
     */
    public function store(StoreAppConfigRequest $request): JsonResponse
    {
        $payload = $request->validated();

        $flag = new AppConfig;
        $flag->key = (string) $payload['key'];
        $flag->value = $payload['value'] ?? null;
        $flag->enabled = (bool) ($payload['enabled'] ?? false);
        $flag->rollout_percentage = (int) ($payload['rollout_percentage'] ?? 0);
        $flag->cohort = $payload['cohort'] ?? null;
        $flag->description = $payload['description'] ?? null;
        $flag->save();

        return $this->respond((new AppConfigResource($flag))->toArray($request), 'Feature flag created.', 201);
    }

    /**
     * GET /api/v1/admin/app-configs/{app_config}
     */
    public function show(Request $request, string $appConfig): JsonResponse
    {
        $this->ensureAdmin($request);

        $flag = AppConfig::query()->where('key', $appConfig)->first();

        if ($flag === null) {
            throw ApiException::notFound('Feature flag');
        }

        return $this->respond((new AppConfigResource($flag))->toArray($request));
    }

    /**
     * PUT /api/v1/admin/app-configs/{app_config}
     */
    public function update(UpdateAppConfigRequest $request, string $appConfig): JsonResponse
    {
        $flag = AppConfig::query()->where('key', $appConfig)->first();

        if ($flag === null) {
            throw ApiException::notFound('Feature flag');
        }

        $payload = $request->validated();

        if (array_key_exists('value', $payload)) {
            $flag->value = $payload['value'];
        }

        if (array_key_exists('enabled', $payload)) {
            $flag->enabled = (bool) $payload['enabled'];
        }

        if (array_key_exists('rollout_percentage', $payload)) {
            $flag->rollout_percentage = (int) $payload['rollout_percentage'];
        }

        if (array_key_exists('cohort', $payload)) {
            $flag->cohort = $payload['cohort'];
        }

        if (array_key_exists('description', $payload)) {
            $flag->description = $payload['description'];
        }
        $flag->save();

        return $this->respond((new AppConfigResource($flag))->toArray($request), 'Feature flag updated.');
    }

    /**
     * DELETE /api/v1/admin/app-configs/{app_config}
     */
    public function destroy(Request $request, string $appConfig): JsonResponse
    {
        $this->ensureAdmin($request);

        $flag = AppConfig::query()->where('key', $appConfig)->first();

        if ($flag === null) {
            throw ApiException::notFound('Feature flag');
        }

        $flag->delete();

        return $this->respond(['deleted' => true], 'Feature flag deleted.');
    }

    /**
     * GET /api/v1/admin/app-configs/{app_config}/evaluate?user_id=&session_id=
     *
     * Runs the flag through `FeatureFlagService::enabled` and
     * returns the boolean. Useful for the Super Admin "try
     * this flag for this user" diagnostic panel.
     */
    public function evaluate(Request $request, string $appConfig): JsonResponse
    {
        $this->ensureAdmin($request);

        if (AppConfig::query()->where('key', $appConfig)->doesntExist()) {
            throw ApiException::notFound('Feature flag');
        }

        $user = null;
        $userId = $request->query('user_id');

        if (is_string($userId) && $userId !== '') {
            $user = User::query()->find($userId);
        }

        $sessionId = $request->query('session_id');
        $sessionId = is_string($sessionId) && $sessionId !== '' ? $sessionId : null;

        $result = $this->flags->enabled($appConfig, $user, $sessionId);

        return $this->respond([
            'key' => $appConfig,
            'enabled' => $result,
            'user_id' => $user?->id,
            'session_id' => $sessionId,
        ]);
    }

    /**
     * @return LengthAwarePaginator<int, AppConfig>
     */
    private function paginate(?string $q, ?bool $enabledOnly, int $perPage): LengthAwarePaginator
    {
        $query = AppConfig::query()->orderBy('key');

        if ($q !== null && $q !== '') {
            $needle = '%'.$q.'%';
            $query->where(function ($w) use ($needle): void {
                $w->where('key', 'like', $needle)
                    ->orWhere('description', 'like', $needle);
            });
        }

        if ($enabledOnly !== null) {
            $query->where('enabled', $enabledOnly);
        }

        return $query->paginate($perPage);
    }
}
