<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Models;

use Database\Factories\Modules\Workflow\Models\WorkflowStateFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * `workflow_states` row per docs/04 §11.
 *
 * A node in a workflow's directed graph. Belongs to a single
 * `WorkflowDefinition`; the `(definition_id, code)` pair is the
 * natural key inside the parent.
 *
 *  - is_initial   : exactly one per definition (enforced at the
 *                   application layer; see
 *                   WorkflowEngine::initialState())
 *  - is_terminal  : 1+ per definition (closed, rejected, ...)
 *  - sort_order   : how the Super Admin portal renders the
 *                   state list
 *  - color        : 7- or 9-char hex for the timeline UI
 *
 * @property string $id
 * @property string $workflow_definition_id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property bool $is_initial
 * @property bool $is_terminal
 * @property int $sort_order
 * @property string|null $color
 * @property bool $active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class WorkflowState extends Model
{
    /** @use HasFactory<WorkflowStateFactory> */
    use HasFactory;
    use HasUuids;

    protected $table = 'workflow_states';

    /** @var list<string> */
    protected $fillable = [
        'workflow_definition_id', 'code', 'name', 'description',
        'is_initial', 'is_terminal', 'sort_order', 'color', 'active',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_initial' => 'boolean',
            'is_terminal' => 'boolean',
            'sort_order' => 'integer',
            'active' => 'boolean',
        ];
    }

    /** @return BelongsTo<WorkflowDefinition, $this> */
    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    /** @return HasMany<WorkflowTransition, $this> */
    public function outgoingTransitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'from_state_id');
    }

    /** @return HasMany<WorkflowTransition, $this> */
    public function incomingTransitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'to_state_id');
    }
}
