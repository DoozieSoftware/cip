<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Resources;

use App\Modules\Settings\Models\AppConfig;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AppConfigResource — the API representation of a feature-flag row.
 * Per AGENTS.md ("Never return Models directly") and docs/03 §20.
 *
 * @property-read AppConfig $resource
 */
class AppConfigResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $flag = $this->resource;

        return [
            'id' => $flag->id,
            'key' => $flag->key,
            'value' => $flag->value,
            'enabled' => (bool) $flag->enabled,
            'rollout_percentage' => (int) $flag->rollout_percentage,
            'cohort' => $flag->cohort,
            'description' => $flag->description,
            'created_at' => $flag->created_at?->toIso8601String(),
            'updated_at' => $flag->updated_at?->toIso8601String(),
        ];
    }
}
