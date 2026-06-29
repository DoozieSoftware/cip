<?php

declare(strict_types=1);

namespace App\Modules\Security\Http\Resources;

use App\Modules\Security\Models\SecurityPolicy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SecurityPolicy
 */
class SecurityPolicyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var SecurityPolicy $policy */
        $policy = $this->resource;

        return [
            'id' => $policy->id,
            'key' => $policy->key,
            'value' => $policy->value,
            'type' => $policy->type,
            'description' => $policy->description,
            'created_at' => $policy->created_at?->toIso8601String(),
            'updated_at' => $policy->updated_at?->toIso8601String(),
        ];
    }
}
