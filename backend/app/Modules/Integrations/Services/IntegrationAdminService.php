<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Services;

use App\Modules\Integrations\Jobs\ProbeIntegrationHealthJob;
use App\Modules\Integrations\Models\Integration;
use App\Modules\Security\Services\SecurityEventService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Support\TraceContext;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

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
    public function __construct(
        private readonly IntegrationUrlGuard $urlGuard,
        private readonly SecurityEventService $securityEvents,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Integration
    {
        $code = $this->stringValue($attributes['code'] ?? null);
        $this->assertUniqueCode($code, null);

        return DB::transaction(function () use ($attributes, $code): Integration {
            return Integration::query()->create([
                'code' => $code,
                'provider' => $this->stringValue($attributes['provider'] ?? null),
                'display_name' => $this->stringValue($attributes['display_name'] ?? null),
                'base_url' => $this->stringValue($attributes['base_url'] ?? null),
                'credentials' => $attributes['credentials'] ?? [],
                'settings' => $attributes['settings'] ?? null,
                'status' => $this->stringValue($attributes['status'] ?? null, 'active'),
            ]);
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Integration $integration, array $attributes): Integration
    {
        if (array_key_exists('code', $attributes)) {
            $this->assertUniqueCode($this->stringValue($attributes['code']), $integration->id);
        }

        return DB::transaction(function () use ($integration, $attributes): Integration {
            $updates = array_intersect_key($attributes, array_flip([
                'code', 'provider', 'display_name', 'base_url',
                'credentials', 'settings', 'status',
            ]));

            if (array_key_exists('credentials', $updates)) {
                $updates['credentials'] = $this->mergeCredentials($integration->credentials, $updates['credentials']);
            }
            $integration->fill($updates);
            $integration->save();

            return $integration->refresh();
        });
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

    public function queueProbe(Integration $integration, User $actor): void
    {
        $this->assertProbeable($integration);

        $actorId = $actor->getKey();

        if (! is_string($actorId) && ! is_int($actorId)) {
            throw ApiException::serverError('The acting user has no valid identifier.');
        }

        ProbeIntegrationHealthJob::dispatch($integration->id, (string) $actorId);
    }

    public function assertProbeable(Integration $integration): void
    {
        if ($integration->status === 'disabled') {
            throw ApiException::conflict('Integration is disabled; enable it before probing.');
        }

        $this->urlGuard->assertSafe($integration->base_url);
    }

    /**
     * Probe the integration's `base_url` from queued work. Every result is
     * appended to the security-event ledger without storing credentials,
     * response bodies, query strings, or other sensitive connector data.
     */
    public function probe(Integration $integration, ?User $actor = null): Integration
    {
        $this->assertProbeable($integration);

        $settings = is_array($integration->settings) ? $integration->settings : [];
        $timeoutMs = isset($settings['timeout_ms']) && is_int($settings['timeout_ms'])
            ? $settings['timeout_ms']
            : 3000;

        $start = microtime(true);

        try {
            $response = Http::timeout(max(1, (int) ceil($timeoutMs / 1000)))
                ->connectTimeout(2)
                ->withHeaders(array_merge(
                    ['User-Agent' => 'CIP-Integration-Probe/1.0'],
                    TraceContext::headers(),
                ))
                ->get($integration->base_url);
        } catch (Throwable $e) {
            $degraded = DB::transaction(function () use ($integration): Integration {
                $integration->status = 'degraded';
                $integration->last_check_at = now();
                $integration->last_error = 'connect_failed';
                $integration->save();

                return $integration->refresh();
            });

            $this->recordProbe($degraded, $actor, 'connect_failed', null, null, $e::class);

            throw $e;
        }
        $latencyMs = (int) round((microtime(true) - $start) * 1000);

        $healthy = $response->successful();

        $probed = DB::transaction(function () use ($integration, $healthy, $latencyMs, $response): Integration {
            $integration->status = $healthy ? 'active' : 'degraded';
            $integration->last_check_at = now();
            $integration->last_error = $healthy
                ? null
                : 'http_'.$response->status().' in '.$latencyMs.'ms';
            $integration->save();

            return $integration->refresh();
        });

        $this->recordProbe(
            $probed,
            $actor,
            $healthy ? 'healthy' : 'http_error',
            $response->status(),
            $latencyMs,
        );

        if (in_array($response->status(), [429, 503, 504], true)) {
            throw new \RuntimeException('Transient integration probe failure: HTTP '.$response->status());
        }

        return $probed;
    }

    private function recordProbe(
        Integration $integration,
        ?User $actor,
        string $outcome,
        ?int $httpStatus,
        ?int $latencyMs,
        ?string $errorType = null,
    ): void {
        $host = parse_url($integration->base_url, PHP_URL_HOST);

        $this->securityEvents->recordSafe(
            'integration.probe.completed',
            $outcome === 'healthy'
                ? SecurityEventService::SEVERITY_INFO
                : SecurityEventService::SEVERITY_WARNING,
            array_filter([
                'integration_id' => $integration->id,
                'integration_code' => $integration->code,
                'target_host' => is_string($host) ? strtolower($host) : null,
                'outcome' => $outcome,
                'http_status' => $httpStatus,
                'latency_ms' => $latencyMs,
                'trace_id' => TraceContext::id(),
                'error_type' => $errorType,
            ], static fn (mixed $value): bool => $value !== null),
            $actor,
        );
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
