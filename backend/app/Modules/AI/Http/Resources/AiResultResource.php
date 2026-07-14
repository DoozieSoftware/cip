<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Resources;

use App\Modules\AI\Models\AiResult;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AiResultResource — the API representation of an `ai_results`
 * row, with the labels collection eager-loaded.
 *
 * @property-read AiResult $resource
 */
class AiResultResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;

        return [
            'id' => $r->id,
            'job_id' => $r->job_id,
            'predicted_type' => $r->predicted_type,
            'confidence' => $r->confidence,
            'recommended_department' => $r->recommended_department,
            'severity' => $r->severity,
            'quality_score' => $r->quality_score,
            'duplicate_score' => $r->duplicate_score,
            'fraud_score' => $r->fraud_score,
            'summary' => $r->summary,
            'license_plate' => $r->license_plate,
            'plate_confidence' => $r->plate_confidence,
            'claim_matches_evidence' => $r->claim_matches_evidence,
            'consistency_score' => $r->consistency_score,
            'mismatch_reason' => $r->mismatch_reason,
            'synthetic_score' => $r->synthetic_score,
            'raw_response' => $r->raw_response,
            'created_at' => $r->created_at?->toIso8601String(),
            'labels' => $r->relationLoaded('labels')
                ? $r->labels->map(fn ($l) => [
                    'id' => $l->id,
                    'label' => $l->label,
                    'confidence' => $l->confidence,
                    'is_primary' => $l->is_primary,
                ])->all()
                : null,
        ];
    }
}
