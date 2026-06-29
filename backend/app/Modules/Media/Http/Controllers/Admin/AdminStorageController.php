<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Controllers\Admin;

use App\Modules\Media\Http\Requests\Admin\UpdateMediaStorageRequest;
use App\Modules\Media\Http\Resources\MediaStorageResource;
use App\Modules\Media\Services\MediaStorageService;
use App\Modules\Settings\Models\Setting;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M12-008 — Super Admin storage configuration per
 * `docs/09` §17.
 *
 *  - GET  /api/v1/admin/media/storage
 *  - PUT  /api/v1/admin/media/storage
 *  - POST /api/v1/admin/media/storage/probe
 *
 * The controller manages a single canonical settings
 * row (`media_storage`) — there is no list or pagination.
 * The `disk` field is one of the configured filesystems
 * (media_local, media_minio, media_s3). Secrets (S3 keys)
 * stay in env; only the disk + bucket + endpoint are
 * stored here.
 */
class AdminStorageController extends BaseController
{
    public function __construct(
        private readonly MediaStorageService $service,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->ensureRow();

        return $this->respond(
            (new MediaStorageResource($row))->toArray($request),
            'Storage configuration.',
        );
    }

    public function update(UpdateMediaStorageRequest $request): JsonResponse
    {
        $this->service->update($request->validated());
        $row = $this->ensureRow();

        return $this->respond(
            (new MediaStorageResource($row))->toArray($request),
            'Storage configuration updated.',
        );
    }

    public function probe(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $result = $this->service->probe();

        return $this->respond($result, 'Storage probe complete.');
    }

    private function ensureRow(): Setting
    {
        $row = Setting::query()->where('key', MediaStorageService::SETTINGS_KEY)->first();
        if ($row !== null) {
            return $row;
        }

        return Setting::set(MediaStorageService::SETTINGS_KEY, $this->service->defaults(), 'array');
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();
        if ($user === null || ! method_exists($user, 'hasRole') || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
