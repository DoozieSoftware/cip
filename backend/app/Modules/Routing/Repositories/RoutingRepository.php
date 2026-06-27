<?php

declare(strict_types=1);

namespace App\Modules\Routing\Repositories;

use App\Modules\Routing\Models\RoutingRule;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Read-side cache for the M7 routing rules.
 *
 * The engine evaluates every active rule on every report, so
 * a DB round-trip per `AiCompleted` event would be wasteful.
 * `activeRules()` returns the active rule set from the
 * `routing` cache tag (1h TTL) on the second and subsequent
 * calls; the first call, and every call after a CRUD write,
 * hits the database.
 *
 * CRUD writes call `invalidate()` which flushes the `routing`
 * tag so the next read repopulates the cache.
 */
class RoutingRepository
{
    public const CACHE_TAG = 'routing';

    public const CACHE_KEY = 'routing:active_rules';

    public const CACHE_TTL_SECONDS = 3600;

    /**
     * @return Collection<int, RoutingRule>
     */
    public function activeRules(): Collection
    {
        return Cache::tags([self::CACHE_TAG])->remember(
            self::CACHE_KEY,
            self::CACHE_TTL_SECONDS,
            fn (): Collection => RoutingRule::query()
                ->where('active', true)
                ->orderBy('priority', 'asc')
                ->orderBy('id', 'asc')
                ->with(['destinationDepartment', 'defaultOfficer', 'defaultPriority'])
                ->get(),
        );
    }

    /**
     * Drop the cached rule set. Called by `RoutingAdminService`
     * after every successful write.
     */
    public function invalidate(): void
    {
        Cache::tags([self::CACHE_TAG])->flush();
    }
}
