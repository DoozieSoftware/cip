<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Http\Resources;

use App\Modules\Workflow\Models\WorkflowDefinition;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * WorkflowResource - the API representation of a
 * `WorkflowDefinition` and its graph (states + transitions).
 *
 * Per AGENTS.md ("Never return Models directly") and docs/03 sec 20.
 * Always includes the full graph so the Super Admin can
 * render the state machine without an extra round-trip.
 *
 * @property-read WorkflowDefinition $resource
 */
class WorkflowResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $def = $this->resource;

        $states = $def->states
            ->sortBy('sort_order')
            ->values()
            ->map(static fn ($s): array => [
                'id' => $s->id,
                'code' => $s->code,
                'name' => $s->name,
                'description' => $s->description,
                'is_initial' => (bool) $s->is_initial,
                'is_terminal' => (bool) $s->is_terminal,
                'sort_order' => (int) $s->sort_order,
                'color' => $s->color,
                'active' => (bool) $s->active,
            ])
            ->all();

        $transitions = $def->transitions
            ->sortBy('priority')
            ->values()
            ->map(static fn ($t): array => [
                'id' => $t->id,
                'from_state_id' => $t->from_state_id,
                'to_state_id' => $t->to_state_id,
                'event' => $t->event,
                'required_role' => $t->required_role,
                'required_permission' => $t->required_permission,
                'conditions' => $t->conditions,
                'sla_minutes' => $t->sla_minutes,
                'notify_before_minutes' => $t->notify_before_minutes,
                'priority' => (int) $t->priority,
                'active' => (bool) $t->active,
            ])
            ->all();

        return [
            'id' => $def->id,
            'code' => $def->code,
            'name' => $def->name,
            'description' => $def->description,
            'active' => (bool) $def->active,
            'states' => $states,
            'transitions' => $transitions,
            'created_at' => $def->created_at?->toIso8601String(),
            'updated_at' => $def->updated_at?->toIso8601String(),
            'deleted_at' => $def->deleted_at?->toIso8601String(),
        ];
    }
}
