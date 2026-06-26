<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Resources;

use App\Modules\Settings\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * SettingResource — the API representation of a Setting row.
 * Per AGENTS.md ("Never return Models directly") and docs/03 §20.
 *
 * `value` is rendered as a JSON-decoded PHP value: the storage
 * layer keeps the original type via the `type` column, so a
 * `type=int` row's `value` is an integer in the response.
 *
 * @property-read Setting $resource
 */
class SettingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $setting = $this->resource;

        return [
            'id' => $setting->id,
            'key' => $setting->key,
            'value' => $setting->value,
            'type' => $setting->type,
            'description' => $setting->description,
            'is_public' => (bool) $setting->is_public,
            'created_at' => $setting->created_at?->toIso8601String(),
            'updated_at' => $setting->updated_at?->toIso8601String(),
            'deleted_at' => $setting->deleted_at?->toIso8601String(),
        ];
    }
}
