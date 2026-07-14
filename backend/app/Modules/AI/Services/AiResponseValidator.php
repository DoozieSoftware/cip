<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\Exceptions\InvalidAiResponseException;
use App\Modules\AI\ValueObjects\AiResponse;

/**
 * Validates an `AiResponse` against the docs/10 §14
 * contract before the orchestrator persists it.
 *
 * The contract requires:
 *  - `labels`: non-empty array, every entry has a non-
 *    empty `label` string, a numeric `confidence` in
 *    [0, 1], and a bool `is_primary`
 *  - exactly one label has `is_primary = true`
 *  - `predictedType` non-empty string
 *  - `confidence` in [0, 1]
 *  - `severity` in {low, medium, high, critical}
 *  - `qualityScore`, `duplicateScore`, `fraudScore` each
 *    in [0, 100]
 *  - `summary` non-empty string
 *
 * Any violation throws `InvalidAiResponseException` with
 * a context array (the caller can serialise this for
 * forensic / re-prompting purposes).
 */
class AiResponseValidator
{
    public const ALLOWED_SEVERITIES = ['low', 'medium', 'high', 'critical'];

    public function validate(AiResponse $resp): void
    {
        if ($resp->labels === []) {
            throw new InvalidAiResponseException('labels must be a non-empty array', [
                'reason' => 'labels_empty',
            ]);
        }

        $primaryCount = 0;

        foreach ($resp->labels as $i => $label) {
            if (! is_array($label)) {
                throw new InvalidAiResponseException("label[{$i}] is not an object", [
                    'reason' => 'label_not_object',
                    'index' => $i,
                ]);
            }
            $name = $label['label'] ?? null;

            if (! is_string($name) || $name === '') {
                throw new InvalidAiResponseException("label[{$i}].label must be a non-empty string", [
                    'reason' => 'label_string_empty',
                    'index' => $i,
                ]);
            }
            $conf = $label['confidence'] ?? null;

            if (! is_numeric($conf) || (float) $conf < 0.0 || (float) $conf > 1.0) {
                throw new InvalidAiResponseException("label[{$i}].confidence must be in [0, 1]", [
                    'reason' => 'label_confidence_out_of_range',
                    'index' => $i,
                ]);
            }

            if (($label['is_primary'] ?? null) === true) {
                $primaryCount++;
            }
        }

        if ($primaryCount !== 1) {
            throw new InvalidAiResponseException("expected exactly 1 primary label, got {$primaryCount}", [
                'reason' => 'primary_count_wrong',
                'count' => $primaryCount,
            ]);
        }

        if ($resp->predictedType === '') {
            throw new InvalidAiResponseException('predicted_type must be a non-empty string', [
                'reason' => 'predicted_type_empty',
            ]);
        }

        if ($resp->confidence < 0.0 || $resp->confidence > 1.0) {
            throw new InvalidAiResponseException('overall confidence must be in [0, 1]', [
                'reason' => 'confidence_out_of_range',
                'value' => $resp->confidence,
            ]);
        }

        if (! in_array($resp->severity, self::ALLOWED_SEVERITIES, true)) {
            throw new InvalidAiResponseException(
                'severity must be one of '.implode(', ', self::ALLOWED_SEVERITIES),
                ['reason' => 'severity_invalid', 'value' => $resp->severity],
            );
        }

        foreach ([
            'qualityScore' => $resp->qualityScore,
            'duplicateScore' => $resp->duplicateScore,
            'fraudScore' => $resp->fraudScore,
        ] as $name => $value) {
            if (! is_int($value) || $value < 0 || $value > 100) {
                throw new InvalidAiResponseException("{$name} must be an int in [0, 100]", [
                    'reason' => $name.'_out_of_range',
                    'value' => $value,
                ]);
            }
        }

        if ($resp->summary === '') {
            throw new InvalidAiResponseException('summary must be a non-empty string', [
                'reason' => 'summary_empty',
            ]);
        }

        if ($resp->consistencyScore !== null && ($resp->consistencyScore < 0 || $resp->consistencyScore > 100)) {
            throw new InvalidAiResponseException('consistencyScore must be an int in [0, 100]', [
                'reason' => 'consistency_score_out_of_range',
                'value' => $resp->consistencyScore,
            ]);
        }

        if ($resp->syntheticScore !== null && ($resp->syntheticScore < 0.0 || $resp->syntheticScore > 1.0)) {
            throw new InvalidAiResponseException('syntheticScore must be in [0, 1]', [
                'reason' => 'synthetic_score_out_of_range',
                'value' => $resp->syntheticScore,
            ]);
        }
    }
}
