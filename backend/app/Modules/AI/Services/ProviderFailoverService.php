<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Per docs/10 §27, the orchestrator never calls a
 * specific provider directly — it always goes through
 * this service so that a transport error on the primary
 * provider transparently fails over to the next provider
 * in priority order.
 *
 * Resolution rules (single SQL query, no per-call loop):
 *  1. `active = true` AND `code = $preferredCode` if the
 *     caller pinned one
 *  2. otherwise all `active = true` ordered by
 *     `(is_fallback ASC, priority ASC, code ASC)`
 *
 * Retry behaviour:
 *  - each provider is retried up to its own
 *    `retry_count` (default 2) with exponential backoff
 *    (100 ms × 2^attempt, capped at 2 s)
 *  - if all attempts on a provider fail, the next
 *    provider is tried
 *  - if every provider fails, the original exception is
 *    re-thrown
 *
 * The service is also a registry: `resolve(name)` returns
 * a bound AIProviderInterface by code, used by the
 * orchestrator to inspect `getName()` / `getModel()`.
 */
class ProviderFailoverService
{
    /**
     * The config row of the provider that most recently satisfied
     * `execute()`, set right before returning a successful response.
     * The orchestrator reads this to record the real provider/model
     * on the `ai_jobs` row instead of a hardcoded placeholder.
     */
    public ?AiProviderConfig $lastUsedProvider = null;

    /**
     * @param  array<string, AIProviderInterface>  $bindings  code => concrete impl
     */
    public function __construct(
        private readonly array $bindings = [],
    ) {}

    public function execute(AiRequest $request, ?string $preferredCode = null): AiResponse
    {
        $providers = $this->resolveProviders($preferredCode);

        if ($providers === []) {
            throw new RuntimeException('no_active_provider_configured');
        }

        $lastError = null;

        foreach ($providers as $cfg) {
            $provider = $this->bindings[$cfg->code] ?? null;

            if ($provider === null) {
                Log::warning('ai.failover.no_binding', ['code' => $cfg->code]);
                continue;
            }

            $maxAttempts = max(1, (int) $cfg->retry_count);

            for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
                try {
                    $resp = $provider->classify($request);
                    $this->lastUsedProvider = $cfg;

                    return $resp;
                } catch (\Throwable $e) {
                    $lastError = $e;
                    Log::warning('ai.failover.attempt_failed', [
                        'provider' => $cfg->code,
                        'attempt' => $attempt,
                        'max' => $maxAttempts,
                        'error' => $e->getMessage(),
                    ]);

                    if ($attempt < $maxAttempts) {
                        $this->backoff($attempt);
                    }
                }
            }
        }

        throw new RuntimeException(
            'all_providers_failed: '.($lastError?->getMessage() ?? 'unknown'),
            0,
            $lastError instanceof \Throwable ? $lastError : null,
        );
    }

    /**
     * @return array<int, AiProviderConfig>
     */
    private function resolveProviders(?string $preferredCode): array
    {
        $q = AiProviderConfig::query()->where('active', true);

        if ($preferredCode !== null) {
            $q->where('code', $preferredCode);
        }

        return $q
            ->orderBy('is_fallback')  // false (0) before true (1)
            ->orderBy('priority')
            ->orderBy('code')
            ->get()
            ->all();
    }

    private function backoff(int $attempt): void
    {
        $delayMs = min(2000, 100 * (2 ** ($attempt - 1)));
        usleep($delayMs * 1000);
    }
}
