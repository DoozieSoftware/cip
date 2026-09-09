<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Resources;

use App\Modules\TextileCollections\Models\TextileDropoffCentre;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read TextileDropoffCentre $resource */
final class TextileDropoffCentreResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'service_zone_id' => $this->resource->service_zone_id,
            'name' => $this->resource->name,
            'address' => $this->resource->address,
            'latitude' => $this->resource->latitude === null ? null : (float) $this->resource->latitude,
            'longitude' => $this->resource->longitude === null ? null : (float) $this->resource->longitude,
            'operating_hours' => $this->resource->operating_hours,
            'public_phone' => $this->resource->public_phone,
            'status' => $this->resource->status,
            'closed_note' => $this->resource->closed_note,
            'active' => $this->resource->active,
            'sort_order' => $this->resource->sort_order,
        ];
    }
}
