<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Media\Models\Media;
use App\Modules\Users\Models\User;
use Database\Factories\Modules\Reports\Models\ReportFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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
 * @property int $workflow_version
 * @property string $location_id
 * @property string|null $assigned_to
 * @property string $title
 * @property string $description
 * @property float|null $ai_confidence
 * @property string|null $ai_label
 * @property float|null $fraud_score
 * @property float|null $duplicate_score
 * @property float|null $mock_gps_score
 * @property bool $is_anonymous
 * @property bool $is_verified
 * @property Carbon|null $submitted_at
 * @property Carbon|null $sla_due_at
 * @property Carbon|null $closed_at
 * @property Carbon|null $resolved_at
 * @property Carbon|null $verification_deadline_at
 * @property string|null $merged_into
 * @property Carbon|null $merged_at
 */
class Report extends Model
{
    /**
     * @use HasFactory<ReportFactory>
     */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    /**
     * M11 — Department-internal notes attached to this report.
     *
     * @return HasMany<InternalNote, $this>
     */
    public function internalNotes(): HasMany
    {
        return $this->hasMany(InternalNote::class, 'report_id');
    }

    protected $table = 'reports';

    /**
     * Keep the in-memory value aligned with the database default so a report
     * can be transitioned in the same request that creates it.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'workflow_version' => 1,
    ];

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
        'ai_label',
        'fraud_score',
        'duplicate_score',
        'mock_gps_score',
        'is_anonymous',
        'is_verified',
        'submitted_at',
        'sla_due_at',
        'closed_at',
        'merged_into',
        'merged_at',
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
            'mock_gps_score' => 'float',
            'workflow_version' => 'integer',
            'is_anonymous' => 'boolean',
            'is_verified' => 'boolean',
            'submitted_at' => 'datetime',
            'sla_due_at' => 'datetime',
            'closed_at' => 'datetime',
            'resolved_at' => 'datetime',
            'verification_deadline_at' => 'datetime',
            'merged_at' => 'datetime',
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
     * Reserve the next tracking number for the current calendar year.
     * The counter row is locked inside a transaction, so concurrent
     * submissions cannot observe the same latest report and collide.
     */
    public static function nextTrackingNumber(): string
    {
        $year = (int) date('Y');
        $next = DB::transaction(function () use ($year): int {
            // `insertOrIgnore` safely bootstraps the year row when two
            // first-ever submissions arrive at the same time.
            DB::table('report_number_sequences')->insertOrIgnore([
                'year' => $year,
                'next_value' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $sequence = DB::table('report_number_sequences')
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            $rawNextValue = $sequence !== null ? $sequence->next_value : null;
            $nextValue = is_numeric($rawNextValue) ? max(1, (int) $rawNextValue) : 1;
            $nextValue = max($nextValue, self::nextValueFromExistingReports($year));

            DB::table('report_number_sequences')
                ->where('year', $year)
                ->update(['next_value' => $nextValue + 1, 'updated_at' => now()]);

            return $nextValue;
        });

        return "CIV-{$year}-".str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }

    public static function nextValueFromExistingReports(int $year): int
    {
        $prefix = "CIV-{$year}-";
        $latestTrackingNumber = self::query()
            ->where('tracking_number', 'like', $prefix.'%')
            ->max('tracking_number');

        if (! is_string($latestTrackingNumber)) {
            return 1;
        }

        if (! preg_match('/^CIV-\d{4}-(\d{6})$/', $latestTrackingNumber, $matches)) {
            return 1;
        }

        return ((int) $matches[1]) + 1;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function citizen(): BelongsTo
    {
        return $this->belongsTo(User::class, 'citizen_id');
    }

    /**
     * Self-referencing FK to the canonical report this duplicate was
     * merged into. Null when this report is not a merge duplicate.
     *
     * @return BelongsTo<Report, $this>
     */
    public function canonicalReport(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'merged_into');
    }

    /**
     * Citizen disputes of an incorrect merge. The active (open) dispute
     * drives the citizen-facing merge-dispute UI.
     *
     * @return HasMany<ReportMergeDispute, $this>
     */
    public function mergeDisputes(): HasMany
    {
        return $this->hasMany(ReportMergeDispute::class, 'report_id');
    }

    /**
     * The active merge dispute (open status), if any.
     */
    public function activeMergeDispute(): ?ReportMergeDispute
    {
        /** @var Collection<int, ReportMergeDispute> $disputes */
        $disputes = $this->relationLoaded('mergeDisputes')
            ? $this->mergeDisputes
            : $this->mergeDisputes()->get();

        return $disputes->firstWhere('status', 'open');
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
     * @return HasMany<ReportStatusHistory, $this>
     */
    public function statusHistory(): HasMany
    {
        return $this->hasMany(ReportStatusHistory::class, 'report_id');
    }

    /**
     * @return HasMany<ReportAssignment, $this>
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(ReportAssignment::class, 'report_id');
    }

    /**
     * Assignments that are still live for the report: never reassigned
     * away, never completed, never cancelled. List endpoints eager-load
     * this narrow relation instead of the full `assignments` history so a
     * page of rows cannot fan out into a long assignment trail per row.
     *
     * @return HasMany<ReportAssignment, $this>
     */
    public function activeAssignments(): HasMany
    {
        return $this->assignments()
            ->whereNull('reassigned_at')
            ->whereNull('completed_at')
            ->where('task_status', '!=', ReportAssignment::TASK_STATUS_CANCELLED);
    }

    /**
     * Evidence and proof media rows for this report. Only metadata lives
     * here; the bytes are served from the configured disk through signed
     * URLs. List endpoints use `withCount('media')` rather than loading
     * the rows.
     *
     * @return HasMany<Media, $this>
     */
    public function media(): HasMany
    {
        // Quarantine rows remain attached for custody/recovery, but they are
        // never report evidence until the scanner has released them CLEAN.
        return $this->hasMany(Media::class, 'report_id')
            ->where('scan_status', MediaScanStatus::CLEAN->value);
    }

    /**
     * M11 — BelongsTo the assigned Department. Nullable for unassigned
     * (in which case the moderator portal still owns the report).
     *
     * @return BelongsTo<Department, $this>
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
}
