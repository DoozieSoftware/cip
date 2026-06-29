<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Services;

use App\Modules\Integrations\Models\Integration;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * T-M12-007 — Super Admin write-side for `integrations`.
 *
 * Owns:
 *  - unique `code` enforcement
 *  - secret-bearing writes
 *  - the `/health` probe that flips the row's status
 *
 * The HTTP probe is best-effort: an integration can be
 * configured without a real upstream; the probe only
 * checks reachability of `base_url`. The status flips
 * to `degraded` on a non-2xx and to `disabled` when the
 * Super Admin explicitly set the row to disabled.
 */
class IntegrationAdminService
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Integration
    {
        $code = (string) ($attributes['code'] ?? '');
        $this->assertUniqueCode($code, null);

        return DB::transaction(function () use ($attributes, $code): Integration {
            return Integration::query()->create([
                'code' => $code,
                'provider' => (string) $attributes['provider'],
                'display_name' => (string) $attributes['display_name'],
                'base_url' => (string) $attributes['base_url'],
                'credentials' => $attributes['credentials'] ?? [],
                'settings' => $attributes['settings'] ?? null,
                'status' => (string) ($attributes['status'] ?? 'active'),
            ]);
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Integration $integration, array $attributes): Integration
    {
        if (array_key_exists('code', $attributes)) {
            $this->assertUniqueCode((string) $attributes['code'], $integration->id);
        }

        return DB::transaction(function () use ($integration, $attributes): Integration {
            $integration->fill(array_intersect_key($attributes, array_flip([
                'code', 'provider', 'display_name', 'base_url',
                'credentials', 'settings', 'status',
            ])));
            $integration->save();

            return $integration->refresh();
        });
    }

    public function delete(Integration $integration): void
    {
        DB::transaction(function () use ($integration): void {
            $integration->delete();
        });
    }

    public function restore(Integration $integration): Integration
    {
        DB::transaction(function () use ($integration): void {
            $integration->restore();
        });

        return $integration->refresh();
    }

    /**
     * Probe the integration's `base_url`. Flips the row
     * to `degraded` on a non-2xx and stores the error.
     */
    public function probe(Integration $integration): Integration
    {
        if ($integration->status === 'disabled') {
            throw ApiException::conflict('Integration is disabled; enable it before probing.');
        }

        $settings = is_array($integration->settings) ? $integration->settings : [];
        $timeoutMs = isset($settings['timeout_ms']) && is_int($settings['timeout_ms'])
            ? $settings['timeout_ms']
            : 3000;

        $start = microtime(true);
        try {
            $response = Http::timeout(max(1, (int) ceil($timeoutMs / 1000)))
                ->connectTimeout(2)
                ->withHeaders(['User-Agent' => 'CIP-Integration-Probe/1.0'])
                ->get($integration->base_url);
        } catch (\Throwable $e) {
            return DB::transaction(function () use ($integration, $e): Integration {
                $integration->status = 'degraded';
                $integration->last_check_at = now();
                $integration->last_error = 'connect_failed: '.$e->getMessage();
                $integration->save();

                return $integration->refresh();
            });
        }
        $latencyMs = (int) round((microtime(true) - $start) * 1000);

        $healthy = $response->successful();

        return DB::transaction(function () use ($integration, $healthy, $latencyMs, $response): Integration {
            $integration->status = $healthy ? 'active' : 'degraded';
            $integration->last_check_at = now();
            $integration->last_error = $healthy
                ? null
                : 'http_'.$response->status().' in '.$latencyMs.'ms';
            $integration->save();

            return $integration->refresh();
        });
    }

    private function assertUniqueCode(string $code, ?string $ignoreId): void
    {
        if ($code === '') {
            throw new ApiException('VALIDATION_FAILED', 'Integration code is required.', 422);
        }

        $existing = Integration::query()->where('code', $code);

        if ($ignoreId !== null) {
            $existing->where('id', '!=', $ignoreId);
        }

        if ($existing->withTrashed()->exists()) {
            throw new ApiException('DUPLICATE_CODE', "Integration code '{$code}' is already in use.", 409);
        }
    }
}
