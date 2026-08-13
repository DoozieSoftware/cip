<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Resources;

use App\Modules\Settings\Models\RetentionHold;
use App\Modules\Settings\Services\RetentionHoldService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read RetentionHold $resource */
final class RetentionHoldResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $hold = $this->resource;
        $service = app(RetentionHoldService::class);

        return [
            'id' => $hold->id,
            'entity_type' => $service->entityAlias((string) $hold->entity_type),
            'entity_id' => $hold->entity_id,
            'reason' => $hold->reason,
            'held_by' => $hold->held_by,
            'holder' => $hold->relationLoaded('holder') && $hold->holder !== null ? [
                'id' => $hold->holder->id,
                'name' => $hold->holder->name,
                'mobile' => $hold->holder->mobile,
            ] : null,
            'expires_at' => $hold->expires_at?->toIso8601String(),
            'released_at' => $hold->released_at?->toIso8601String(),
            'released_by' => $hold->released_by,
            'release_reason' => $hold->release_reason,
            'releaser' => $hold->relationLoaded('releaser') && $hold->releaser !== null ? [
                'id' => $hold->releaser->id,
                'name' => $hold->releaser->name,
                'mobile' => $hold->releaser->mobile,
            ] : null,
            'active' => $hold->isActive(),
            'created_at' => $hold->created_at->toIso8601String(),
            'updated_at' => $hold->updated_at->toIso8601String(),
        ];
    }
}
