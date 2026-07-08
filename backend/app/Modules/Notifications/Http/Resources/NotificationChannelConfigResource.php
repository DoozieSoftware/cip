<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serialises a `notification_channel_configs` row.
 *
 * `credentials` is masked: keys are kept (so the Super
 * Admin UI can show which fields are configured) but every
 * value is replaced with "********". The retry_policy,
 * settings, and per_locale_defaults blocks are returned in
 * full because they are non-sensitive.
 */
class NotificationChannelConfigResource extends JsonResource
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
            'channel' => $this->channel,
            'code' => $this->code,
            'display_name' => $this->display_name,
            'credentials' => $masked,
            'retry_policy' => $this->retry_policy,
            'settings' => $this->settings,
            'per_locale_defaults' => $this->per_locale_defaults,
            'active' => (bool) $this->active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
