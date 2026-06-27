<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Resources;

use App\Modules\AI\Models\PromptVersion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * PromptVersionResource — the API representation of a
 * `prompt_versions` row.
 *
 * @property-read PromptVersion $resource
 */
class PromptVersionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $p = $this->resource;

        return [
            'id' => $p->id,
            'name' => $p->name,
            'version' => $p->version,
            'purpose' => $p->purpose,
            'provider_code' => $p->provider_code,
            'prompt_text' => $p->prompt_text,
            'expected_json_schema' => $p->expected_json_schema,
            'status' => $p->status,
            'approved_by' => $p->approved_by,
            'approved_at' => $p->approved_at?->toIso8601String(),
            'created_at' => $p->created_at?->toIso8601String(),
            'updated_at' => $p->updated_at?->toIso8601String(),
        ];
    }
}
