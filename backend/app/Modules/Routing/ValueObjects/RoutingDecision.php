<?php

declare(strict_types=1);

namespace App\Modules\Routing\ValueObjects;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Users\Models\User;

/**
 * The output of `RoutingEngine::resolve(Report)`. Carries
 * the routing decision (which department / officer / priority
 * / SLA to assign) and the matched rule that produced it.
 *
 * `matchedRule` is `null` when the decision was produced
 * by `RoutingFallbackService` (no active rule matched; the
 * configured default destination was used instead).
 *
 * Construction is via the static `fromRule()` factory so
 * every field is derived from the same `RoutingRule` row;
 * downstream code never has to remember which fields are
 * optional. `fromFallback()` is the matching factory for
 * the no-rule path.
 */
final class RoutingDecision
{
    public function __construct(
        public readonly ?RoutingRule $matchedRule,
        public readonly Department $destinationDepartment,
        public readonly ?User $defaultOfficer,
        public readonly ReportPriority $defaultPriority,
        public readonly int $defaultSlaMinutes,
    ) {}

    public static function fromRule(RoutingRule $rule): self
    {
        $dept = $rule->destinationDepartment;
        $pri = $rule->defaultPriority;

        if ($dept === null) {
            throw new \InvalidArgumentException("Rule '{$rule->id}' has no destination department loaded.");
        }

        if ($pri === null) {
            throw new \InvalidArgumentException("Rule '{$rule->id}' has no default priority loaded.");
        }

        return new self(
            matchedRule: $rule,
            destinationDepartment: $dept,
            defaultOfficer: $rule->defaultOfficer,
            defaultPriority: $pri,
            defaultSlaMinutes: (int) $rule->default_sla_minutes,
        );
    }

    public static function fromFallback(
        Department $department,
        ?User $officer,
        ReportPriority $priority,
        int $slaMinutes,
    ): self {
        return new self(
            matchedRule: null,
            destinationDepartment: $department,
            defaultOfficer: $officer,
            defaultPriority: $priority,
            defaultSlaMinutes: $slaMinutes,
        );
    }
}
