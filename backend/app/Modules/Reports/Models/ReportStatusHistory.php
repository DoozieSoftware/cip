<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Modules\Users\Models\User;
use Database\Factories\Modules\Reports\Models\ReportStatusHistoryFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * `report_status_history` row per docs/04 §7.
 *
 * Append-only — the model does not expose update/delete.
 *
 * @property string $id
 * @property string $report_id
 * @property string|null $from_status_id
 * @property string $to_status_id
 * @property string|null $actor_id
 * @property string|null $reason
 * @property array<string, mixed>|null $metadata
 */
class ReportStatusHistory extends Model
{
    /**
     * @use HasFactory<ReportStatusHistoryFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'report_status_history';

    /**
     * @var list<string>
     */
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'report_id',
        'from_status_id',
        'to_status_id',
        'actor_id',
        'reason',
        'metadata',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Block Eloquent update/delete to keep the table append-only
     * per docs/11 §28. Direct DB::table writes are still possible
     * but discouraged — the WriteStatusHistory listener is the
     * only sanctioned writer (T-M4-018).
     */
    protected static function booted(): void
    {
        static::updating(function (): bool {
            return false;
        });
        static::deleting(function (): bool {
            return false;
        });
    }

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
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /**
     * @return BelongsTo<ReportStatus, $this>
     */
    public function fromStatus(): BelongsTo
    {
        return $this->belongsTo(ReportStatus::class, 'from_status_id');
    }

    /**
     * @return BelongsTo<ReportStatus, $this>
     */
    public function toStatus(): BelongsTo
    {
        return $this->belongsTo(ReportStatus::class, 'to_status_id');
    }
}
