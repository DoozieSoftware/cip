<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Citizen dispute of an incorrect merge. A dispute records the
 * citizen's reason and resets the merged report out of the `merged`
 * terminal state so it can be re-reviewed.
 *
 * @property string $id
 * @property string $report_id
 * @property string $citizen_id
 * @property string $reason
 * @property string $status
 * @property string|null $resolution_note
 * @property string|null $resolved_by
 */
class ReportMergeDispute extends Model
{
    use HasUuids;

    protected $table = 'report_merge_disputes';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'report_id',
        'citizen_id',
        'reason',
        'status',
        'resolution_note',
        'resolved_by',
    ];

    /**
     * @return BelongsTo<Report, $this>
     */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function citizen(): BelongsTo
    {
        return $this->belongsTo(User::class, 'citizen_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
