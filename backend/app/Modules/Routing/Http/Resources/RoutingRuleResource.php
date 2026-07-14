<?php

declare(strict_types=1);

namespace App\Modules\Routing\Http\Resources;

use App\Modules\Routing\Models\RoutingRule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * RoutingRuleResource - API representation of a
 * `routing_rules` row per docs/09 sec 12.
 *
 * The Super Admin Portal renders the rule list + editor
 * from this shape. The `conditions` payload is the raw
 * JSON DSL (the RoutingCondition DSL parser is the only
 * consumer).
 *
 * @property-read RoutingRule $resource
 */
class RoutingRuleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $rule = $this->resource;

        return [
            'id' => $rule->id,
            'name' => $rule->name,
            'description' => $rule->description,
            'priority' => (int) $rule->priority,
            'conditions' => $rule->conditions ?? [],
            'destination_department_id' => $rule->destination_department_id,
            'destination_department' => $rule->destinationDepartment === null ? null : [
                'id' => $rule->destinationDepartment->id,
                'code' => $rule->destinationDepartment->code,
                'name' => $rule->destinationDepartment->name,
            ],
            'default_officer_id' => $rule->default_officer_id,
            'default_priority_id' => $rule->default_priority_id,
            'default_priority' => $rule->defaultPriority === null ? null : [
                'id' => $rule->defaultPriority->id,
                'code' => $rule->defaultPriority->code,
                'name' => $rule->defaultPriority->name,
            ],
            'default_sla_minutes' => (int) $rule->default_sla_minutes,
            'active' => (bool) $rule->active,
            'created_at' => $rule->created_at?->toIso8601String(),
            'updated_at' => $rule->updated_at?->toIso8601String(),
        ];
    }
}
