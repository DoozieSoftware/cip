<?php

declare(strict_types=1);

namespace App\Modules\AI\ValueObjects;

/**
 * Provider-agnostic structured response from the AI
 * vision pipeline.
 *
 * The contract here matches the `docs/10` §14 schema
 * that AiResponseValidator (T-M8-016) checks every
 * provider output against. Concrete providers parse
 * their wire format into this shape before returning.
 *
 *  - `labels` is the full per-label confidence map;
 *    one entry MUST have `is_primary = true` and the
 *    orchestrator writes that to `reports.ai_label` for
 *    the M7 routing rules
 *  - `predictedType` is the canonical category slug
 *    (e.g. "pothole", "garbage", "streetlight_out")
 *  - `confidence` is the overall confidence [0.0, 1.0]
 *  - `recommendedDepartment` is the department slug
 *    the AI thinks should own the report; the routing
 *    engine treats this as a hint, not a binding
 *  - `severity` is the canonical severity bucket
 *  - The three 0–100 scores (quality, duplicate, fraud)
 *    feed the moderator review flagging logic
 *  - `licensePlate` is the detected vehicle number plate
 *    (ANPR) when the report involves a vehicle violation;
 *    null for non-vehicle categories. `plateConfidence`
 *    is the VLM's confidence in the plate read (0.0–1.0)
 *  - `raw` keeps the unparsed provider payload for
 *    forensic / re-prompting / cost audit
 */
final class AiResponse
{
    /**
     * @param  array<int, array{label: string, confidence: float, is_primary: bool}>  $labels
     * @param  array<string, mixed>  $raw
     */
    public function __construct(
        public readonly array $labels,
        public readonly string $predictedType,
        public readonly float $confidence,
        public readonly string $recommendedDepartment,
        public readonly string $severity,
        public readonly int $qualityScore,
        public readonly int $duplicateScore,
        public readonly int $fraudScore,
        public readonly string $summary,
        public readonly array $raw = [],
        public readonly ?string $licensePlate = null,
        public readonly ?float $plateConfidence = null,
    ) {}

    /**
     * The top-confidence label (is_primary=true if any,
     * otherwise highest confidence). Returns null when
     * labels is empty.
     */
    public function primaryLabel(): ?string
    {
        if ($this->labels === []) {
            return null;
        }

        foreach ($this->labels as $l) {
            if ($l['is_primary'] === true) {
                return $l['label'];
            }
        }

        $top = $this->labels[0];
        $best = $top;

        foreach ($this->labels as $l) {
            if ($l['confidence'] > $best['confidence']) {
                $best = $l;
            }
        }

        return $best['label'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'labels' => $this->labels,
            'predicted_type' => $this->predictedType,
            'confidence' => $this->confidence,
            'recommended_department' => $this->recommendedDepartment,
            'severity' => $this->severity,
            'quality_score' => $this->qualityScore,
            'duplicate_score' => $this->duplicateScore,
            'fraud_score' => $this->fraudScore,
            'summary' => $this->summary,
            'license_plate' => $this->licensePlate,
            'plate_confidence' => $this->plateConfidence,
            'raw' => $this->raw,
        ];
    }
}
