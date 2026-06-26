<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Repositories;

use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use Illuminate\Support\Facades\Cache;

/**
 * Read-side repository for the M6 workflow engine.
 *
 * Caches the `workflow_definitions` rows + their
 * `workflow_states` + `workflow_transitions` in a single
 * `Cache::remember` per code, for 1 hour. Cache is
 * invalidated on any update of the cached payload —
 * the `invalidate($code)` method is the explicit hook
 * for the Super Admin CRUD endpoints (M6-013, M6-014)
 * to call after they write.
 *
 * Cache key layout:
 *
 *   workflow:def:<code>           -> WorkflowDefinition + states + transitions
 *   workflow:def:id:<id>           -> WorkflowDefinition (for ID-based lookups)
 *   workflow:def:code:<code>       -> WorkflowDefinition (for code-based lookups)
 *
 * The TTL is 1h. The 409 invalidation pattern means the
 * Super Admin can publish a workflow change without a
 * deploy and the engine picks it up immediately on the
 * next request.
 */
class WorkflowRepository
{
    private const TTL_SECONDS = 3600;

    public function findActiveByCode(string $code): ?WorkflowDefinition
    {
        return $this->remember("workflow:def:code:{$code}", function () use ($code): ?WorkflowDefinition {
            return WorkflowDefinition::query()
                ->where('code', $code)
                ->where('active', true)
                ->with(['states', 'transitions'])
                ->first();
        });
    }

    public function findById(string $id): ?WorkflowDefinition
    {
        return $this->remember("workflow:def:id:{$id}", function () use ($id): ?WorkflowDefinition {
            return WorkflowDefinition::query()
                ->where('id', $id)
                ->with(['states', 'transitions'])
                ->first();
        });
    }

    /**
     * Build the full payload that the engine reads (definition
     * + states + transitions) keyed by `code`. Cached for 1h.
     *
     * @return array{definition: WorkflowDefinition, states: array<string, WorkflowState>, transitions: list<WorkflowTransition>}|null
     */
    public function loadGraph(string $code): ?array
    {
        $def = $this->findActiveByCode($code);

        if ($def === null) {
            return null;
        }
        $states = [];

        foreach ($def->states as $s) {
            $states[$s->code] = $s;
        }
        /** @var list<WorkflowTransition> $transitions */
        $transitions = $def->transitions->all();

        return [
            'definition' => $def,
            'states' => $states,
            'transitions' => $transitions,
        ];
    }

    /**
     * Invalidate the cache for a definition. Call from the
     * Super Admin CRUD endpoints after every write.
     */
    public function invalidate(string $code): void
    {
        Cache::forget("workflow:def:code:{$code}");
        // Also clear by id; the caller knows the id.
        $def = WorkflowDefinition::query()->where('code', $code)->first();

        if ($def !== null) {
            Cache::forget("workflow:def:id:{$def->id}");
        }
    }

    /**
     * @template T
     *
     * @param  callable():T  $callback
     * @return T
     */
    private function remember(string $key, callable $callback): mixed
    {
        return Cache::remember($key, self::TTL_SECONDS, $callback);
    }
}
