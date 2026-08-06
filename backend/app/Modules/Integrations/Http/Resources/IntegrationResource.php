<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Http\Resources;

use App\Modules\Integrations\Models\Integration;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serialises an `Integration` row per `docs/12` §34.
 *
 * The `credentials` payload is masked — keys are kept
 * (so the Super Admin UI can show which fields are
 * configured) but every value is replaced with
 * "********". A write-only field, never echoed back.
 *
 * @property-read Integration $resource
 */
class IntegrationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $integration = $this->resource;

        /** @var array<string, mixed>|null $raw */
        $raw = $integration->credentials;
        $masked = null;

        if (is_array($raw)) {
            $masked = [];

            foreach ($raw as $key => $_value) {
                $masked[(string) $key] = '********';
            }
        }

        return [
            'id' => $integration->id,
            'code' => $integration->code,
            'provider' => $integration->provider,
            'display_name' => $integration->display_name,
            'base_url' => $integration->base_url,
            'credentials' => $masked,
            'settings' => $integration->settings,
            'status' => $integration->status,
            'last_check_at' => $integration->last_check_at?->toIso8601String(),
            'last_error' => $integration->last_error,
            'created_at' => $integration->created_at?->toIso8601String(),
            'updated_at' => $integration->updated_at?->toIso8601String(),
        ];
    }
}
