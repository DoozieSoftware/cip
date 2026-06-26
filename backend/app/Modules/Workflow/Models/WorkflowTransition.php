<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Models;

use Database\Factories\Modules\Workflow\Models\WorkflowTransitionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * `workflow_transitions` row per docs/04 §11.
 *
 * A directed edge in a workflow graph. When a `Report` is in
 * `from_state_id` and an event is published, the engine
 * resolves the row with the highest `priority` that the actor
 * is allowed to take and fires the transition.
 *
 *  - required_role          : the Spatie role the actor must have
 *  - required_permission    : alternative — the Spatie permission
 *  - conditions             : JSON expression evaluated against
 *                             the Report + Actor context. See
 *                             WorkflowEngine::matchesConditions().
 *  - sla_minutes            : the deadline from `created_at`
 *  - notify_before_minutes  : pre-breach notification lead time
 *  - priority               : ties broken by priority DESC
 *
 * @property string $id
 * @property string $workflow_definition_id
 * @property string $from_state_id
 * @property string $to_state_id
 * @property string $event
 * @property string|null $required_role
 * @property string|null $required_permission
 * @property array<string, mixed>|null $conditions
 * @property int|null $sla_minutes
 * @property int|null $notify_before_minutes
 * @property int $priority
 * @property bool $active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class WorkflowTransition extends Model
{
    /** @use HasFactory<WorkflowTransitionFactory> */
    use HasFactory;
    use HasUuids;

    protected $table = 'workflow_transitions';

    /** @var list<string> */
    protected $fillable = [
        'workflow_definition_id', 'from_state_id', 'to_state_id', 'event',
        'required_role', 'required_permission', 'conditions',
        'sla_minutes', 'notify_before_minutes', 'priority', 'active',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'conditions' => 'array',
            'sla_minutes' => 'integer',
            'notify_before_minutes' => 'integer',
            'priority' => 'integer',
            'active' => 'boolean',
        ];
    }

    /** @return BelongsTo<WorkflowDefinition, $this> */
    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    /** @return BelongsTo<WorkflowState, $this> */
    public function fromState(): BelongsTo
    {
        return $this->belongsTo(WorkflowState::class, 'from_state_id');
    }

    /** @return BelongsTo<WorkflowState, $this> */
    public function toState(): BelongsTo
    {
        return $this->belongsTo(WorkflowState::class, 'to_state_id');
    }
}
