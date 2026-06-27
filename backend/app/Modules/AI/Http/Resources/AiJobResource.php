<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Resources;

use App\Modules\AI\Models\AiJob;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AiJobResource — the API representation of an `ai_jobs` row.
 * The internal pipeline endpoint uses this; the full payload
 * (including `tokens_in`, `tokens_out`, `cost_cents`) is only
 * visible to callers with the `system` role.
 *
 * @property-read AiJob $resource
 */
class AiJobResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $job = $this->resource;

        return [
            'id' => $job->id,
            'report_id' => $job->report_id,
            'prompt_version_id' => $job->prompt_version_id,
            'provider_code' => $job->provider_code,
            'model' => $job->model,
            'status' => $job->status,
            'requested_at' => $job->requested_at?->toIso8601String(),
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->completed_at?->toIso8601String(),
            'processing_time_ms' => $job->processing_time_ms,
            'error_code' => $job->error_code,
            'retry_count' => $job->retry_count,
            'tokens_in' => $job->tokens_in,
            'tokens_out' => $job->tokens_out,
            'cost_cents' => $job->cost_cents,
            'created_at' => $job->created_at?->toIso8601String(),
            'updated_at' => $job->updated_at?->toIso8601String(),
        ];
    }
}
