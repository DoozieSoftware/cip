<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Controllers\Admin;

use App\Modules\Settings\Http\Requests\StoreSettingRequest;
use App\Modules\Settings\Http\Requests\UpdateSettingRequest;
use App\Modules\Settings\Http\Resources\SettingResource;
use App\Modules\Settings\Models\Setting;
use App\Modules\Settings\Services\SettingsService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super Admin CRUD for `settings` per docs/05 §10, docs/09 §18
 * and docs/04 §18.
 *
 *  - GET    /api/v1/admin/settings
 *  - POST   /api/v1/admin/settings
 *  - GET    /api/v1/admin/settings/{setting}
 *  - PUT    /api/v1/admin/settings/{setting}
 *  - DELETE /api/v1/admin/settings/{setting}
 *
 * The path parameter is the setting's `key` (e.g.
 * `ai.vision.provider`) — that is the natural primary handle
 * for a setting and is what `SettingsService::get()` consumes.
 * Every write goes through `SettingsService::set()` so the
 * Redis cache is invalidated and the master-config endpoint
 * picks up the change on its next read.
 *
 * The `super_admin` role gate is on each Form Request's
 * `authorize()` method; index/show/destroy double-check it
 * defensively.
 */
class SettingController extends BaseController
{
    public function __construct(
        private readonly SettingsService $service,
    ) {}

    /**
     * GET /api/v1/admin/settings
     */
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $perPage = (int) $request->query('per_page', 25);
        $perPage = $perPage > 0 ? min($perPage, 200) : 25;
        $q = $request->query('q');
        $publicOnly = filter_var($request->query('public'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        $page = $this->paginate($q, $publicOnly, $perPage);

        return $this->respondPaginated($page);
    }

    /**
     * POST /api/v1/admin/settings
     */
    public function store(StoreSettingRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $key = (string) $payload['key'];
        $value = $payload['value'];
        $type = (string) $payload['type'];

        $setting = $this->service->set($key, $value, $type);

        if (array_key_exists('description', $payload) && $payload['description'] !== null) {
            $setting->description = (string) $payload['description'];
        }

        if (array_key_exists('is_public', $payload) && $payload['is_public'] !== null) {
            $setting->is_public = (bool) $payload['is_public'];
        }
        $setting->save();

        return $this->respond((new SettingResource($setting))->toArray($request), 'Setting created.', 201);
    }

    /**
     * GET /api/v1/admin/settings/{setting}
     */
    public function show(Request $request, string $setting): JsonResponse
    {
        $this->ensureAdmin($request);

        $row = Setting::query()->where('key', $setting)->first();

        if ($row === null) {
            throw ApiException::notFound('Setting');
        }

        return $this->respond((new SettingResource($row))->toArray($request));
    }

    /**
     * PUT /api/v1/admin/settings/{setting}
     */
    public function update(UpdateSettingRequest $request, string $setting): JsonResponse
    {
        $row = Setting::query()->where('key', $setting)->first();

        if ($row === null) {
            throw ApiException::notFound('Setting');
        }

        $payload = $request->validated();
        $valueChanged = array_key_exists('value', $payload);
        $typeChanged = array_key_exists('type', $payload);

        if ($valueChanged || $typeChanged) {
            $value = $valueChanged ? $payload['value'] : $row->value;
            // value is stored as JSON, so a non-array value still
            // round-trips through Setting::set.
            $row = $this->service->set($row->key, $value, (string) ($typeChanged ? $payload['type'] : $row->type));
        }

        if (array_key_exists('description', $payload)) {
            $row->description = $payload['description'];
        }

        if (array_key_exists('is_public', $payload)) {
            $row->is_public = (bool) $payload['is_public'];
        }
        $row->save();

        return $this->respond((new SettingResource($row))->toArray($request), 'Setting updated.');
    }

    /**
     * DELETE /api/v1/admin/settings/{setting}
     *
     * Soft-deletes the row (the audit trail in audit_logs is
     * preserved). The cache entry is cleared so a subsequent
     * `SettingsService::get()` returns the default.
     */
    public function destroy(Request $request, string $setting): JsonResponse
    {
        $this->ensureAdmin($request);

        $row = Setting::query()->where('key', $setting)->first();

        if ($row === null) {
            throw ApiException::notFound('Setting');
        }

        $this->service->forget($row->key);

        return $this->respond(['deleted' => true], 'Setting deleted.');
    }

    /**
     * @return LengthAwarePaginator<int, Setting>
     */
    private function paginate(?string $q, ?bool $publicOnly, int $perPage): LengthAwarePaginator
    {
        $query = Setting::query()->orderBy('key');

        if ($q !== null && $q !== '') {
            $needle = '%'.$q.'%';
            $query->where(function ($w) use ($needle): void {
                $w->where('key', 'like', $needle)
                    ->orWhere('description', 'like', $needle);
            });
        }

        if ($publicOnly !== null) {
            $query->where('is_public', $publicOnly);
        }

        return $query->paginate($perPage);
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
