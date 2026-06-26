<?php

declare(strict_types=1);

namespace App\Modules\Routing\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\ValueObjects\RoutingDecision;
use Illuminate\Support\Collection;

/**
 * M7 RoutingEngine.
 *
 * Loads the active routing rules (not soft-deleted) in
 * ascending `priority` order, evaluates each rule's
 * `conditions` against the report, and returns the
 * decision from the first matching rule.
 *
 * The result is deterministic for a given
 * `(report, [rule set])` tuple — equal priority ties are
 * broken by `id` (uuid-lexicographic) so re-evaluation
 * after a rule insert / update is stable.
 *
 * `resolve()` returns `null` if no rule matches; the
 * caller (the M7 AssignmentService) is responsible for
 * the fallback (e.g. assigning to a default department).
 */
class RoutingEngine
{
    public function __construct(
        private readonly RoutingCondition $condition,
    ) {}

    public function resolve(Report $report): ?RoutingDecision
    {
        foreach ($this->loadActiveRules() as $rule) {
            if (! $this->condition->evaluate($rule->conditions ?? [], $report)) {
                continue;
            }

            return RoutingDecision::fromRule($rule);
        }

        return null;
    }

    /**
     * Resolve a report against an explicit rule set
     * (used by the test suite for determinism).
     *
     * @param  iterable<RoutingRule>  $rules
     */
    public function resolveWith(Report $report, iterable $rules): ?RoutingDecision
    {
        $sorted = Collection::make($rules)
            ->sortBy([
                ['priority', 'asc'],
                ['id', 'asc'],
            ])
            ->values();

        foreach ($sorted as $rule) {
            if (! $this->condition->evaluate($rule->conditions ?? [], $report)) {
                continue;
            }

            return RoutingDecision::fromRule($rule);
        }

        return null;
    }

    /**
     * @return Collection<int, RoutingRule>
     */
    private function loadActiveRules(): Collection
    {
        return RoutingRule::query()
            ->where('active', true)
            ->orderBy('priority', 'asc')
            ->orderBy('id', 'asc')
            ->with(['destinationDepartment', 'defaultOfficer', 'defaultPriority'])
            ->get();
    }
}
