<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Users\Models\User;
use Database\Factories\Modules\Reports\Models\ReportAssignmentFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * `report_assignments` row per docs/04 sec 7 + sec 12.
 *
 * Tracks ownership of a report. A report can be re-assigned
 * — a new row is inserted, the previous row is preserved.
 * The active assignment is the most recent one for the
 * report that has not been completed / rejected.
 *
 * @property string $id
 * @property string $report_id
 * @property string $department_id
 * @property bool $is_primary
 * @property string $kind
 * @property string|null $officer_id
 * @property string|null $assigned_by
 * @property Carbon $assigned_at
 * @property Carbon|null $accepted_at
 * @property Carbon|null $completed_at
 * @property string|null $reassignment_reason
 * @property Carbon|null $reassigned_at
 * @property string $task_status
 * @property int|null $sla_minutes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ReportAssignment extends Model
{
    public const KIND_PRIMARY = 'primary';

    public const KIND_SECONDARY = 'secondary';

    public const TASK_STATUS_OPEN = 'open';

    public const TASK_STATUS_COMPLETED = 'completed';

    public const TASK_STATUS_CANCELLED = 'cancelled';

    /** @use HasFactory<ReportAssignmentFactory> */
    use HasFactory;

    use HasUuids;

    protected $table = 'report_assignments';

    /** @var list<string> */
    protected $fillable = [
        'report_id', 'department_id', 'is_primary', 'kind', 'officer_id',
        'assigned_by', 'assigned_at', 'accepted_at',
        'completed_at', 'reassignment_reason', 'reassigned_at',
        'task_status', 'sla_minutes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
            'sla_minutes' => 'integer',
            'assigned_at' => 'datetime',
            'accepted_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Report, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    /**
     * Open assignments: not completed, not cancelled.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query
            ->whereNull('completed_at')
            ->where('task_status', self::TASK_STATUS_OPEN);
    }

    /**
     * Open PRIMARY assignments — the report's root-cause owner. Guards that
     * previously asked "any open assignment" must use this scope so secondary
     * (linked) tasks never block routing decisions.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeOpenPrimary(Builder $query): Builder
    {
        return $query
            ->open()
            ->where('is_primary', true)
            ->where('kind', self::KIND_PRIMARY);
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /** @return BelongsTo<User, $this> */
    public function officer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'officer_id');
    }
}
