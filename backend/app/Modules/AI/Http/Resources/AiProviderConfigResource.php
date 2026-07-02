<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Resources;

use App\Modules\AI\Models\AiProviderConfig;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AiProviderConfigResource — the API representation of a provider
 * configuration. The spec is explicit (docs/09 §13): secrets MUST
 * NEVER be serialised. `credentials` is stripped from the response
 * and replaced with a `has_secret` boolean so the Super Admin can
 * see whether a key is attached without seeing the key itself.
 *
 * @property-read AiProviderConfig $resource
 */
class AiProviderConfigResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $cfg = $this->resource;

        return [
            'id' => $cfg->id,
            'code' => $cfg->code,
            'driver' => $cfg->driver,
            'name' => $cfg->name,
            'base_url' => $cfg->base_url,
            'auth_type' => $cfg->auth_type,
            'has_secret' => ! empty($cfg->credentials['api_key'] ?? null),
            'extra_headers' => $cfg->extra_headers ?? [],
            'model' => $cfg->model,
            'temperature' => $cfg->temperature,
            'timeout_ms' => $cfg->timeout_ms,
            'retry_count' => $cfg->retry_count,
            'is_fallback' => $cfg->is_fallback,
            'priority' => $cfg->priority,
            'active' => $cfg->active,
            'created_at' => $cfg->created_at?->toIso8601String(),
            'updated_at' => $cfg->updated_at?->toIso8601String(),
        ];
    }
}
