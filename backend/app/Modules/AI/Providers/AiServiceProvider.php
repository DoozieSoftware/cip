<?php

declare(strict_types=1);

namespace App\Modules\AI\Providers;

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Services\ProviderFailoverService;
use App\Modules\AI\Support\AiProviderFactory;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;
use Throwable;

/**
 * Fixes the container-binding gap flagged in the post-audit
 * remediation plan: `ProviderFailoverService` takes a `$bindings`
 * array of real `AIProviderInterface` instances, but nothing ever
 * built that array in production — `AppServiceProvider::register()`
 * was empty, so every real report submission threw
 * `all_providers_failed` the moment it reached the AI pipeline.
 *
 * On boot, this provider reads every active `ai_provider_configs`
 * row, builds a real provider instance for each via
 * `AiProviderFactory`, and binds the resulting map into a singleton
 * `ProviderFailoverService`. A row whose driver fails to construct
 * (e.g. bad config) is logged and skipped rather than crashing boot —
 * the failover service already treats a missing binding as "try the
 * next provider."
 */
class AiServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ProviderFailoverService::class, function (): ProviderFailoverService {
            return new ProviderFailoverService($this->buildBindings());
        });
    }

    /**
     * @return array<string, AIProviderInterface>
     */
    private function buildBindings(): array
    {
        $bindings = [];

        try {
            $factory = new AiProviderFactory;

            foreach (AiProviderConfig::query()->where('active', true)->get() as $cfg) {
                try {
                    $bindings[$cfg->code] = $factory->make($cfg);
                } catch (Throwable $e) {
                    Log::warning('ai.provider.bind_failed', [
                        'code' => $cfg->code,
                        'driver' => $cfg->driver,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        } catch (Throwable $e) {
            // The table may not exist yet (fresh install, before the first
            // `migrate` run) — boot must not fail on that.
            Log::warning('ai.provider.bootstrap_failed', ['error' => $e->getMessage()]);
        }

        return $bindings;
    }
}
