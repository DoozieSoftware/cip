<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Notifications\Models\NotificationChannelConfig;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * T-M12-009 — Super Admin write-side for notification
 * channel configs. Owns uniqueness on (channel, code) and
 * invalidates the dispatcher cache on every write.
 */
class NotificationChannelConfigService
{
    private const CACHE_PREFIX = 'notification_channel:';

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): NotificationChannelConfig
    {
        $channel = (string) $attributes['channel'];
        $code = (string) $attributes['code'];
        $this->assertUnique($channel, $code, null);

        $row = DB::transaction(function () use ($attributes, $channel, $code): NotificationChannelConfig {
            return NotificationChannelConfig::query()->create([
                'channel' => $channel,
                'code' => $code,
                'display_name' => (string) $attributes['display_name'],
                'credentials' => $attributes['credentials'] ?? [],
                'retry_policy' => $attributes['retry_policy'] ?? NotificationChannelConfig::DEFAULT_RETRY,
                'settings' => $attributes['settings'] ?? null,
                'per_locale_defaults' => $attributes['per_locale_defaults'] ?? null,
                'active' => array_key_exists('active', $attributes) ? (bool) $attributes['active'] : true,
            ]);
        });

        $this->invalidate($row);

        return $row;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(NotificationChannelConfig $row, array $attributes): NotificationChannelConfig
    {
        $row = DB::transaction(function () use ($row, $attributes): NotificationChannelConfig {
            $row->fill(array_intersect_key($attributes, array_flip([
                'display_name', 'credentials', 'retry_policy',
                'settings', 'per_locale_defaults', 'active',
            ])));
            $row->save();

            return $row->refresh();
        });

        $this->invalidate($row);

        return $row;
    }

    public function delete(NotificationChannelConfig $row): void
    {
        DB::transaction(function () use ($row): void {
            $row->delete();
        });
        $this->invalidate($row);
    }

    public function restore(NotificationChannelConfig $row): NotificationChannelConfig
    {
        DB::transaction(function () use ($row): void {
            $row->restore();
        });
        $this->invalidate($row);

        return $row->refresh();
    }

    private function invalidate(NotificationChannelConfig $row): void
    {
        Cache::forget(self::CACHE_PREFIX.$row->channel.':'.$row->code);
        Cache::forget(self::CACHE_PREFIX.$row->channel.':active');
    }

    private function assertUnique(string $channel, string $code, ?string $ignoreId): void
    {
        $existing = NotificationChannelConfig::query()
            ->where('channel', $channel)
            ->where('code', $code);

        if ($ignoreId !== null) {
            $existing->where('id', '!=', $ignoreId);
        }

        if ($existing->withTrashed()->exists()) {
            throw new ApiException(
                'DUPLICATE_CODE',
                "Notification channel '{$channel}/{$code}' is already in use.",
                409,
            );
        }
    }
}
