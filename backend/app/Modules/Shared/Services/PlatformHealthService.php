<?php

declare(strict_types=1);

namespace App\Modules\Shared\Services;

use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\Media\Services\MediaStorageService;
use App\Modules\Settings\Models\Setting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * T-M12-015 — Aggregate platform health per `docs/09` §22.
 *
 * Probes each component and reports:
 *  - status: ok | degraded | down
 *  - latency_ms: integer
 *  - detail: free-form message (for `ok`) or error (for `degraded` / `down`)
 *  - checked_at: ISO-8601 timestamp
 *
 * Probes are best-effort and never throw; a component
 * that fails its probe is reported as `down` with the
 * exception message.
 */
class PlatformHealthService
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public function snapshot(): array
    {
        return [
            'database' => $this->probeDatabase(),
            'redis' => $this->probeRedis(),
            'queue' => $this->probeQueue(),
            'ai' => $this->probeAi(),
            'storage' => $this->probeStorage(),
            'scheduler' => $this->probeScheduler(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        $components = $this->snapshot();
        $status = 'ok';
        $down = 0;
        $degraded = 0;
        foreach ($components as $row) {
            $value = $row['status'] ?? 'down';
            if ($value === 'down') {
                $down++;
            } elseif ($value === 'degraded') {
                $degraded++;
            }
        }
        if ($down > 0) {
            $status = 'down';
        } elseif ($degraded > 0) {
            $status = 'degraded';
        }

        return [
            'status' => $status,
            'checked_at' => now()->toIso8601String(),
            'components' => $components,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function probeDatabase(): array
    {
        $start = microtime(true);
        try {
            $value = DB::select('select 1 as ok');
            $latency = (int) round((microtime(true) - $start) * 1000);
            $ok = is_array($value) && count($value) === 1;

            return [
                'status' => $ok ? 'ok' : 'degraded',
                'latency_ms' => $latency,
                'detail' => $ok ? 'select 1 succeeded' : 'unexpected result',
                'checked_at' => now()->toIso8601String(),
                'driver' => (string) config('database.default'),
            ];
        } catch (Throwable $e) {
            return $this->down('database', $e);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function probeRedis(): array
    {
        if (! in_array((string) config('cache.default'), ['redis', 'predis'], true)
            && ! in_array((string) config('queue.default'), ['redis', 'predis'], true)
            && ! class_exists(\Illuminate\Redis\RedisManager::class)) {
            return [
                'status' => 'ok',
                'latency_ms' => 0,
                'detail' => 'redis not configured; skipped',
                'checked_at' => now()->toIso8601String(),
            ];
        }

        $start = microtime(true);
        try {
            Redis::connection()->ping();
            $latency = (int) round((microtime(true) - $start) * 1000);

            return [
                'status' => 'ok',
                'latency_ms' => $latency,
                'detail' => 'PONG',
                'checked_at' => now()->toIso8601String(),
            ];
        } catch (Throwable $e) {
            // Redis may not be available in the test env.
            return [
                'status' => 'degraded',
                'latency_ms' => 0,
                'detail' => 'redis unavailable: '.$e->getMessage(),
                'checked_at' => now()->toIso8601String(),
            ];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function probeQueue(): array
    {
        $start = microtime(true);
        try {
            $size = Queue::size();
            $latency = (int) round((microtime(true) - $start) * 1000);

            return [
                'status' => 'ok',
                'latency_ms' => $latency,
                'detail' => 'driver='.config('queue.default').' size='.$size,
                'checked_at' => now()->toIso8601String(),
                'driver' => (string) config('queue.default'),
                'size' => (int) $size,
            ];
        } catch (Throwable $e) {
            return $this->down('queue', $e);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function probeAi(): array
    {
        $start = microtime(true);
        try {
            if (! Schema::hasTable('ai_provider_configs')) {
                return [
                    'status' => 'degraded',
                    'latency_ms' => 0,
                    'detail' => 'ai_provider_configs table not yet migrated',
                    'checked_at' => now()->toIso8601String(),
                ];
            }
            $providers = AiProviderConfig::query()->where('active', true)->count();
            $latency = (int) round((microtime(true) - $start) * 1000);

            return [
                'status' => $providers > 0 ? 'ok' : 'degraded',
                'latency_ms' => $latency,
                'detail' => $providers.' active provider(s)',
                'checked_at' => now()->toIso8601String(),
                'active_providers' => $providers,
            ];
        } catch (Throwable $e) {
            return $this->down('ai', $e);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function probeStorage(): array
    {
        $start = microtime(true);
        try {
            $disk = Setting::query()->where('key', MediaStorageService::SETTINGS_KEY)->first();
            $current = $disk !== null && is_array($disk->value) ? $disk->value : [];
            $name = (string) ($current['disk'] ?? (string) config('cip.media.disk', 'local'));
            if ($name === 'local') {
                $name = 'media_local';
            }
            Storage::disk($name)->put('.cip-probe', (string) now());
            Storage::disk($name)->delete('.cip-probe');
            $latency = (int) round((microtime(true) - $start) * 1000);

            return [
                'status' => 'ok',
                'latency_ms' => $latency,
                'detail' => 'disk='.$name,
                'checked_at' => now()->toIso8601String(),
                'disk' => $name,
            ];
        } catch (Throwable $e) {
            return $this->down('storage', $e);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function probeScheduler(): array
    {
        $start = microtime(true);
        try {
            $events = \Illuminate\Support\Facades\Schedule::events();
            $latency = (int) round((microtime(true) - $start) * 1000);
            $count = is_array($events) ? count($events) : iterator_count($events);

            return [
                'status' => 'ok',
                'latency_ms' => $latency,
                'detail' => $count.' scheduled event(s)',
                'checked_at' => now()->toIso8601String(),
                'event_count' => $count,
            ];
        } catch (Throwable $e) {
            return $this->down('scheduler', $e);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function down(string $component, Throwable $e): array
    {
        return [
            'status' => 'down',
            'latency_ms' => 0,
            'detail' => $component.' probe failed: '.$e->getMessage(),
            'checked_at' => now()->toIso8601String(),
        ];
    }
}
