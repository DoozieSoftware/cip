<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Controllers\Admin;

use App\Modules\Settings\Http\Requests\IndexRetentionHoldsRequest;
use App\Modules\Settings\Http\Requests\ReleaseRetentionHoldRequest;
use App\Modules\Settings\Http\Requests\StoreRetentionHoldRequest;
use App\Modules\Settings\Http\Resources\RetentionHoldResource;
use App\Modules\Settings\Models\RetentionHold;
use App\Modules\Settings\Services\RetentionHoldService;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Super-admin legal hold lifecycle endpoints. */
final class RetentionHoldController extends BaseController
{
    public function __construct(private readonly RetentionHoldService $service) {}

    public function index(IndexRetentionHoldsRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $perPage = is_numeric($payload['per_page'] ?? null) ? (int) $payload['per_page'] : 50;

        $page = $this->service->paginate($payload, $perPage);
        $items = [];

        foreach ($page->items() as $item) {
            if ($item instanceof RetentionHold) {
                $items[] = (new RetentionHoldResource($item))->toArray($request);
            }
        }

        return $this->respond($items, 'OK', 200, [
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    public function export(IndexRetentionHoldsRequest $request): StreamedResponse
    {
        return $this->service->export($request->validated());
    }

    public function store(StoreRetentionHoldRequest $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user('sanctum');
        $validated = $request->validated();
        $entityType = $validated['entity_type'] ?? null;
        $entityId = $validated['entity_id'] ?? null;
        $reason = $validated['reason'] ?? null;

        if (! is_string($entityType) || ! is_string($entityId) || ! is_string($reason)) {
            return $this->respondError('Invalid retention hold payload.', 422, 'VALIDATION_FAILED');
        }
        $attributes = [
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'reason' => $reason,
        ];

        if (array_key_exists('expires_at', $validated) && ($validated['expires_at'] === null || is_string($validated['expires_at']))) {
            $attributes['expires_at'] = $validated['expires_at'];
        }
        $hold = $this->service->create($actor, $attributes);
        $request->attributes->set('audit.entity', 'retention_hold');
        $request->attributes->set('audit.entity_id', $hold->id);
        $request->attributes->set('audit.action', 'retention_hold.create');
        $request->attributes->set('audit.after', $hold->toArray());

        return $this->respond((new RetentionHoldResource($hold))->toArray($request), 'Retention hold created.', 201);
    }

    public function release(ReleaseRetentionHoldRequest $request, RetentionHold $retentionHold): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user('sanctum');
        $validated = $request->validated();
        $releaseReason = $validated['release_reason'] ?? null;

        if (! is_string($releaseReason)) {
            return $this->respondError('Invalid release payload.', 422, 'VALIDATION_FAILED');
        }
        $released = $this->service->release($actor, $retentionHold, $releaseReason);
        $request->attributes->set('audit.entity', 'retention_hold');
        $request->attributes->set('audit.entity_id', $released->id);
        $request->attributes->set('audit.action', 'retention_hold.release');
        $request->attributes->set('audit.after', $released->toArray());

        return $this->respond((new RetentionHoldResource($released))->toArray($request), 'Retention hold released.');
    }
}
