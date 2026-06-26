<?php

declare(strict_types=1);

namespace App\Modules\Settings\Services;

use App\Modules\Settings\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * SettingsService per docs/04 §18 and docs/09 §18.
 *
 * Wraps the static `Setting::get` / `Setting::set` helpers with a
 * Redis cache so the master-config endpoint (T-M3-019) and the
 * Super Admin UI can read settings without hitting the database
 * on every request.
 *
 *  - Cache prefix: `settings:`
 *  - TTL: 1 hour (3600 s)
 *  - Invalidation: every `set()` / `forget()` clears the matching
 *    key (no tag-based flush — we want surgical invalidation so
 *    concurrent reads of unrelated settings are not penalised)
 *  - Misses are NOT cached. A miss is cheap to compute (a single
 *    indexed lookup) and caching the default would prevent the
 *    application from picking up a newly-inserted setting until
 *    the cache entry expired.
 */
class SettingsService
{
    private const CACHE_PREFIX = 'settings:';

    private const CACHE_TTL_SECONDS = 3600;

    /**
     * Read a setting by key. Returns `$default` on miss.
     * Type coercion is the model's job (see Setting::coerce).
     */
    public function get(string $key, mixed $default = null): mixed
    {
        $cacheKey = self::CACHE_PREFIX.$key;

        if (Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        $value = Setting::get($key, $default);

        // Only cache present values. A null default for a missing
        // key is the common case; we don't want a sticky null
        // hiding a freshly-inserted setting.
        if ($value !== $default || $this->rowExists($key)) {
            Cache::put($cacheKey, $value, self::CACHE_TTL_SECONDS);
        }

        return $value;
    }

    /**
     * Upsert a setting by key and invalidate the cache entry.
     */
    public function set(string $key, mixed $value, string $type = 'string'): Setting
    {
        $row = Setting::set($key, $value, $type);
        $this->forgetCache($key);

        return $row;
    }

    /**
     * Drop a single key from the cache. Soft-deletes the row
     * (forget() is reversible; for an irreversible delete use
     * Setting::query()->where('key', $key)->forceDelete()).
     */
    public function forget(string $key): void
    {
        Setting::query()->where('key', $key)->delete();
        $this->forgetCache($key);
    }

    private function forgetCache(string $key): void
    {
        Cache::forget(self::CACHE_PREFIX.$key);
    }

    private function rowExists(string $key): bool
    {
        return Setting::query()->where('key', $key)->exists();
    }
}
