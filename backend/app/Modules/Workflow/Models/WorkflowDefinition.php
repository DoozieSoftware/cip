<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Models;

use Database\Factories\Modules\Workflow\Models\WorkflowDefinitionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * `workflow_definitions` row per docs/04 §11.
 *
 * A named, versioned state machine. The actual graph lives on
 * `workflow_states` + `workflow_transitions`; this row carries
 * the human-readable name, machine code, an active flag, and
 * soft-delete support so a Super Admin can retire a definition
 * without losing the audit trail of reports that used it.
 *
 * Reports that were on this definition keep referencing it
 * even after `active=false` (the soft delete column is purely
 * administrative).
 *
 * @property string $id
 * @property string $name
 * @property string $code
 * @property string|null $description
 * @property bool $active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class WorkflowDefinition extends Model
{
    /** @use HasFactory<WorkflowDefinitionFactory> */
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'workflow_definitions';

    /** @var list<string> */
    protected $fillable = [
        'name', 'code', 'description', 'active',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    /** @return HasMany<WorkflowState, $this> */
    public function states(): HasMany
    {
        return $this->hasMany(WorkflowState::class, 'workflow_definition_id');
    }

    /** @return HasMany<WorkflowTransition, $this> */
    public function transitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'workflow_definition_id');
    }
}
