<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * `ai_results` row per docs/04 §10 and docs/10 §14.
 *
 * One row per successful (or failed-with-diagnostics) AI
 * job. The result is immutable — a re-run writes a new row
 * keyed off a new `ai_jobs.id`. `raw_response` is kept for
 * forensic / re-prompting / cost audit purposes.
 *
 * @property string $id
 * @property string $job_id
 * @property string $predicted_type
 * @property float $confidence
 * @property string $recommended_department
 * @property string $severity
 * @property int $quality_score
 * @property int $duplicate_score
 * @property int $fraud_score
 * @property string $summary
 * @property string|null $license_plate
 * @property float|null $plate_confidence
 * @property array<string, mixed> $raw_response
 * @property Carbon $created_at
 */
class AiResult extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'ai_results';

    public $timestamps = false;

    protected $fillable = [
        'job_id', 'predicted_type', 'confidence', 'recommended_department',
        'severity', 'quality_score', 'duplicate_score', 'fraud_score',
        'summary', 'license_plate', 'plate_confidence', 'raw_response', 'created_at',
    ];

    protected $casts = [
        'confidence' => 'float',
        'quality_score' => 'integer',
        'duplicate_score' => 'integer',
        'fraud_score' => 'integer',
        'plate_confidence' => 'float',
        'raw_response' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<AiJob, self>
     */
    public function job(): BelongsTo
    {
        return $this->belongsTo(AiJob::class, 'job_id');
    }

    /**
     * @return HasMany<AiLabel>
     */
    public function labels(): HasMany
    {
        return $this->hasMany(AiLabel::class, 'result_id');
    }

    /**
     * The primary (top-confidence) label for this result.
     * The application invariant is exactly one row per
     * result with is_primary=true; this convenience
     * accessor returns it (or null).
     */
    public function primaryLabel(): ?AiLabel
    {
        return $this->labels()->where('is_primary', true)->first();
    }
}
