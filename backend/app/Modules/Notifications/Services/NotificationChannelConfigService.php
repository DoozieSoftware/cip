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
        $channel = $this->stringValue($attributes['channel'] ?? null);
        $code = $this->stringValue($attributes['code'] ?? null);
        $this->assertUnique($channel, $code, null);

        $row = DB::transaction(function () use ($attributes, $channel, $code): NotificationChannelConfig {
            return NotificationChannelConfig::query()->create([
                'channel' => $channel,
                'code' => $code,
                'display_name' => $this->stringValue($attributes['display_name'] ?? null),
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
            $updates = array_intersect_key($attributes, array_flip([
                'display_name', 'credentials', 'retry_policy',
                'settings', 'per_locale_defaults', 'active',
            ]));

            if (array_key_exists('credentials', $updates)) {
                $updates['credentials'] = $this->mergeCredentials($row->credentials, $updates['credentials']);
            }
            $row->fill($updates);
            $row->save();

            return $row->refresh();
        });

        $this->invalidate($row);

        return $row;
    }

    /**
     * @param  array<string, mixed>|null  $existing
     * @return array<string, mixed>|null
     */
    private function mergeCredentials(?array $existing, mixed $incoming): ?array
    {
        if (! is_array($incoming)) {
            return $existing;
        }
        $merged = $existing ?? [];

        foreach ($incoming as $key => $value) {
            if (! is_string($key) || $value === null || $value === '' || $value === '********') {
                continue;
            }
            $merged[$key] = $value;
        }

        return $merged === [] ? null : $merged;
    }

    private function stringValue(mixed $value, string $fallback = ''): string
    {
        return is_string($value) ? $value : $fallback;
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
