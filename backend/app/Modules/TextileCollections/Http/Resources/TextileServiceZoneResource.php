<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Resources;

use App\Modules\TextileCollections\Models\TextileServiceZone;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read TextileServiceZone $resource */
final class TextileServiceZoneResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $department = $this->resource->relationLoaded('department') ? $this->resource->department : null;

        return [
            'id' => $this->resource->id,
            'code' => $this->resource->code,
            'name' => $this->resource->name,
            'center' => $this->resource->center_latitude === null ? null : [
                'latitude' => $this->resource->center_latitude,
                'longitude' => $this->resource->center_longitude,
            ],
            'service_radius_km' => $this->resource->service_radius_km,
            'methods' => array_values(array_filter([
                $this->resource->dropoff_enabled ? 'dropoff' : null,
                $this->resource->premises_pickup_enabled ? 'premises' : null,
            ])),
            'dropoff' => ! $this->resource->dropoff_enabled ? null : [
                'name' => $this->resource->dropoff_name,
                'address' => $this->resource->dropoff_address,
            ],
            'readiness_instructions' => $this->resource->readiness_instructions,
            'partner' => $department === null ? null : [
                'id' => $department->id,
                'name' => $department->name,
            ],
        ];
    }
}
