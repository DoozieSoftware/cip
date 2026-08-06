<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Resources\Admin;

use App\Modules\Departments\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serialises an `Organization` row per `docs/09` §6.
 *
 * @property-read Organization $resource
 */
class OrganizationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $organization = $this->resource;

        return [
            'id' => $organization->id,
            'code' => $organization->code,
            'name' => $organization->name,
            'legal_name' => $organization->legal_name,
            'domain' => $organization->domain,
            'contact' => $organization->contact,
            'branding' => $organization->branding,
            'storage_quota_mb' => (int) $organization->storage_quota_mb,
            'settings' => $organization->settings,
            'active' => (bool) $organization->active,
            'created_at' => $organization->created_at?->toIso8601String(),
            'updated_at' => $organization->updated_at?->toIso8601String(),
        ];
    }
}
