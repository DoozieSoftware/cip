<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serialises an `Organization` row per `docs/09` §6.
 */
class OrganizationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'legal_name' => $this->legal_name,
            'domain' => $this->domain,
            'contact' => $this->contact,
            'branding' => $this->branding,
            'storage_quota_mb' => (int) $this->storage_quota_mb,
            'settings' => $this->settings,
            'active' => (bool) $this->active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
