<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use App\Modules\Reports\Models\Report;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * `ai_jobs` row per docs/04 §10 and docs/10 §13.
 *
 * One row per attempt to run the vision pipeline on a
 * report. Multiple rows per report_id are expected
 * (retries); the `ai_results` table holds the actual
 * response payload, joined 1:1 on `job_id` when the job
 * succeeds.
 *
 * Statuses:
 *  - `queued`     — created, waiting for the worker
 *  - `running`    — picked up by a worker, in flight
 *  - `succeeded`  — result row written
 *  - `failed`     — non-retryable error (e.g. JSON
 *                   validation failure, schema mismatch)
 *  - `timeout`    — exceeded `provider_config.timeout_ms`
 *
 * @property string $id
 * @property string $report_id
 * @property string $prompt_version_id
 * @property string $provider_code
 * @property string $model
 * @property string $status
 * @property Carbon $requested_at
 * @property Carbon|null $started_at
 * @property Carbon|null $completed_at
 * @property int|null $processing_time_ms
 * @property string|null $error_code
 * @property int $retry_count
 * @property int|null $tokens_in
 * @property int|null $tokens_out
 * @property int|null $cost_cents
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class AiJob extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'ai_jobs';

    protected $fillable = [
        'report_id', 'prompt_version_id', 'provider_code', 'model',
        'status', 'requested_at', 'started_at', 'completed_at',
        'processing_time_ms', 'error_code', 'retry_count',
        'tokens_in', 'tokens_out', 'cost_cents',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'processing_time_ms' => 'integer',
        'retry_count' => 'integer',
        'tokens_in' => 'integer',
        'tokens_out' => 'integer',
        'cost_cents' => 'integer',
    ];

    public const STATUS_QUEUED = 'queued';

    public const STATUS_RUNNING = 'running';

    public const STATUS_SUCCEEDED = 'succeeded';

    public const STATUS_FAILED = 'failed';

    public const STATUS_TIMEOUT = 'timeout';

    /**
     * @return BelongsTo<Report, self>
     */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    /**
     * @return BelongsTo<PromptVersion, self>
     */
    public function promptVersion(): BelongsTo
    {
        return $this->belongsTo(PromptVersion::class, 'prompt_version_id');
    }

    /**
     * @return HasOne<AiResult>
     */
    public function result(): HasOne
    {
        return $this->hasOne(AiResult::class, 'job_id');
    }
}
