<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Modules\Users\Models\User;
use Database\Factories\Modules\Reports\Models\ReportFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * `reports` row per docs/04 §7.
 *
 * The `tracking_number` (`CIV-YYYY-NNNNNN`) is generated on
 * create in `boot()`. The 6-digit suffix is per-year and uses
 * a deterministic counter that is reset at year boundaries —
 * actual production deployment will use a distributed sequence
 * (T-M4-xxx backlog), but the in-app generator is good enough
 * for V1 single-node deployments.
 *
 * @property string $id
 * @property string $tracking_number
 * @property string|null $citizen_id
 * @property string $report_type_id
 * @property string|null $department_id
 * @property string $current_status_id
 * @property string $priority_id
 * @property string|null $workflow_id
 * @property string $location_id
 * @property string|null $assigned_to
 * @property string $title
 * @property string $description
 * @property float|null $ai_confidence
 * @property float|null $fraud_score
 * @property float|null $duplicate_score
 * @property bool $is_anonymous
 * @property bool $is_verified
 * @property \Illuminate\Support\Carbon|null $submitted_at
 * @property \Illuminate\Support\Carbon|null $closed_at
 */
class Report extends Model
{
    /**
     * @use HasFactory<ReportFactory>
     */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'reports';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tracking_number',
        'citizen_id',
        'report_type_id',
        'department_id',
        'current_status_id',
        'priority_id',
        'workflow_id',
        'location_id',
        'assigned_to',
        'title',
        'description',
        'ai_confidence',
        'fraud_score',
        'duplicate_score',
        'is_anonymous',
        'is_verified',
        'submitted_at',
        'closed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ai_confidence' => 'float',
            'fraud_score' => 'float',
            'duplicate_score' => 'float',
            'is_anonymous' => 'boolean',
            'is_verified' => 'boolean',
            'submitted_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Report $report): void {
            if (! is_string($report->tracking_number) || $report->tracking_number === '') {
                $report->tracking_number = self::nextTrackingNumber();
            }
        });
    }

    /**
     * Generate the next tracking number for the current calendar
     * year. Format: `CIV-YYYY-NNNNNN` (6-digit zero-padded
     * per-year sequence). The DB-side `unique` constraint is
     * the safety net; a race that returns the same number is
     * recovered by the unique-violation retry in the service
     * layer.
     */
    public static function nextTrackingNumber(): string
    {
        $year = (int) date('Y');
        $prefix = "CIV-{$year}-";
        $latest = static::query()
            ->where('tracking_number', 'like', $prefix.'%')
            ->orderByDesc('tracking_number')
            ->value('tracking_number');

        $next = 1;
        if (is_string($latest) && $latest !== '') {
            $tail = substr($latest, strlen($prefix));
            if (ctype_digit($tail)) {
                $next = (int) $tail + 1;
            }
        }

        return $prefix.str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function citizen(): BelongsTo
    {
        return $this->belongsTo(User::class, 'citizen_id');
    }

    /**
     * @return BelongsTo<ReportType, $this>
     */
    public function reportType(): BelongsTo
    {
        return $this->belongsTo(ReportType::class, 'report_type_id');
    }

    /**
     * @return BelongsTo<ReportStatus, $this>
     */
    public function status(): BelongsTo
    {
        return $this->belongsTo(ReportStatus::class, 'current_status_id');
    }

    /**
     * @return BelongsTo<ReportPriority, $this>
     */
    public function priority(): BelongsTo
    {
        return $this->belongsTo(ReportPriority::class, 'priority_id');
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    /**
     * @return HasMany<\App\Modules\Reports\Models\ReportStatusHistory, $this>
     */
    public function statusHistory(): HasMany
    {
        return $this->hasMany(ReportStatusHistory::class, 'report_id');
    }
}
