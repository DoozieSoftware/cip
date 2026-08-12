<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Models;

use App\Modules\Reports\Models\Report;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowSlaBreach extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'workflow_sla_breaches';

    /** @var list<string> */
    protected $fillable = [
        'report_id', 'transition_id', 'breached_at', 'notified_at', 'payload',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'breached_at' => 'datetime',
            'notified_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    /** @return BelongsTo<Report, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    /** @return BelongsTo<WorkflowTransition, $this> */
    public function transition(): BelongsTo
    {
        return $this->belongsTo(WorkflowTransition::class, 'transition_id');
    }
}
