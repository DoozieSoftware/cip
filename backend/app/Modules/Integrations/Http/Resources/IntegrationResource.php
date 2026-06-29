<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serialises an `Integration` row per `docs/12` §34.
 *
 * The `credentials` payload is masked — keys are kept
 * (so the Super Admin UI can show which fields are
 * configured) but every value is replaced with
 * "********". A write-only field, never echoed back.
 */
class IntegrationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var array<string, mixed>|null $raw */
        $raw = $this->credentials;
        $masked = null;
        if (is_array($raw)) {
            $masked = [];
            foreach ($raw as $key => $_value) {
                $masked[(string) $key] = '********';
            }
        }

        return [
            'id' => $this->id,
            'code' => $this->code,
            'provider' => $this->provider,
            'display_name' => $this->display_name,
            'base_url' => $this->base_url,
            'credentials' => $masked,
            'settings' => $this->settings,
            'status' => $this->status,
            'last_check_at' => $this->last_check_at?->toIso8601String(),
            'last_error' => $this->last_error,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
