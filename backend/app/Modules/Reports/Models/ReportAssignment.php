<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use Database\Factories\Modules\Reports\Models\ReportAssignmentFactory;
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
 * @property string|null $officer_id
 * @property string|null $assigned_by
 * @property Carbon $assigned_at
 * @property Carbon|null $accepted_at
 * @property Carbon|null $completed_at
 * @property string|null $reassignment_reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ReportAssignment extends Model
{
    /** @use HasFactory<ReportAssignmentFactory> */
    use HasFactory;

    use HasUuids;

    protected $table = 'report_assignments';

    /** @var list<string> */
    protected $fillable = [
        'report_id', 'department_id', 'officer_id',
        'assigned_by', 'assigned_at', 'accepted_at',
        'completed_at', 'reassignment_reason',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
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

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Departments\Models\Department::class, 'department_id');
    }

    /** @return BelongsTo<User, $this> */
    public function officer(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Users\Models\User::class, 'officer_id');
    }
}
