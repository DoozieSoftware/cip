<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\AI\Models\PromptVersion;
use App\Modules\AI\Services\AiMediaReferenceResolver;
use App\Modules\AI\Services\ProviderFailoverService;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\Departments\Models\ReportProofVerification;
use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class ProofVerificationService
{
    private const LOCATION_MATCH_METERS = 75.0;

    public function __construct(
        private readonly ProviderFailoverService $ai,
        private readonly AiMediaReferenceResolver $mediaReferences,
    ) {}

    public function verify(Media $proof): ReportProofVerification
    {
        $report = $proof->report()->with('location')->first();

        if (! $report instanceof Report) {
            throw ApiException::notFound('Report');
        }

        $evidence = Media::query()
            ->where('report_id', $report->getKey())
            ->where('role', 'evidence')
            ->where('type', 'PHOTO')
            ->where('scan_status', MediaScanStatus::CLEAN->value)
            ->orderBy('created_at')
            ->first();

        $distance = $this->distanceFromReportLocation($report, $proof);
        $locationMatch = $distance === null ? null : $distance <= self::LOCATION_MATCH_METERS;
        $locationConfidence = $this->locationConfidence($distance);
        $visualConfidence = $this->visualConfidence($evidence, $proof, $locationMatch);
        $aiReview = $this->aiReview($report, $evidence, $proof, $distance, $locationConfidence);

        if ($aiReview !== null) {
            $visualConfidence = $aiReview['visual_confidence'];
        }

        $overall = (int) round(($locationConfidence * 0.55) + ($visualConfidence * 0.45));
        $status = $this->status($overall, $locationMatch);

        if ($aiReview !== null && $aiReview['proof_matches_report'] === false) {
            $status = 'mismatch';
        } elseif ($aiReview !== null && $aiReview['needs_human_review'] === true && $status === 'match') {
            $status = 'needs_review';
        }

        return ReportProofVerification::query()->updateOrCreate(
            ['proof_media_id' => $proof->getKey()],
            [
                'report_id' => $report->getKey(),
                'assignment_id' => $proof->assignment_id,
                'department_id' => $proof->department_id,
                'evidence_media_id' => $evidence?->getKey(),
                'status' => $status,
                'location_confidence' => $locationConfidence,
                'visual_confidence' => $visualConfidence,
                'overall_confidence' => $overall,
                'distance_meters' => $distance,
                'location_match' => $locationMatch,
                'summary' => $aiReview['summary'] ?? $this->summary($status, $distance, $locationMatch, $visualConfidence),
                'perspective_note' => $aiReview['perspective_note'] ?? $this->perspectiveNote($evidence, $proof),
                'metadata' => [
                    'engine' => $aiReview === null ? 'proof_validation_v1_fallback' : 'proof_verification_ai_v1',
                    'location_match_threshold_m' => self::LOCATION_MATCH_METERS,
                    'proof_capture' => $this->captureMetadata($proof),
                    'evidence_media_present' => $evidence !== null,
                    'same_file_reused' => $evidence !== null && $evidence->checksum === $proof->checksum,
                    'ai_review' => $aiReview,
                ],
                'checked_at' => Carbon::now(),
            ],
        );
    }

    public function assertAssignmentHasProof(Report $report, ReportAssignment $assignment): void
    {
        $proof = Media::query()
            ->where('report_id', $report->getKey())
            ->where('assignment_id', $assignment->getKey())
            ->where('role', 'proof')
            ->where('type', 'PHOTO')
            ->where('scan_status', MediaScanStatus::CLEAN->value)
            ->exists();

        if (! $proof) {
            throw new ApiException(
                'PROOF_REQUIRED',
                'Upload at least one proof photo from the work location before marking this work fixed.',
                422,
            );
        }
    }

    public function latestForAssignment(Report $report, ReportAssignment $assignment): ?ReportProofVerification
    {
        return ReportProofVerification::query()
            ->where('report_id', $report->getKey())
            ->where('assignment_id', $assignment->getKey())
            ->orderByDesc('checked_at')
            ->orderByDesc('created_at')
            ->first();
    }

    public function eligibleForAutomaticClosure(ReportProofVerification $verification): bool
    {
        $metadata = is_array($verification->metadata) ? $verification->metadata : [];
        $engine = $metadata['engine'] ?? null;
        $threshold = $this->automaticClosureThreshold();

        return $engine === 'proof_verification_ai_v1'
            && $verification->status === 'match'
            && $verification->location_match === true
            && $verification->overall_confidence > $threshold;
    }

    public function automaticClosureThreshold(): int
    {
        $value = config('cip.ai.proof_review.auto_close_min', 80);

        if (! is_numeric($value)) {
            return 80;
        }

        return max(0, min(100, (int) $value));
    }

    private function distanceFromReportLocation(Report $report, Media $proof): ?float
    {
        $location = $report->relationLoaded('location') ? $report->location : $report->location()->first();
        $capture = $this->captureMetadata($proof);
        $lat = $capture['latitude'] ?? null;
        $lng = $capture['longitude'] ?? null;

        if (
            $location === null
            || ! is_numeric($lat)
            || ! is_numeric($lng)
        ) {
            return null;
        }

        return $this->haversineMeters(
            (float) $location->latitude,
            (float) $location->longitude,
            (float) $lat,
            (float) $lng,
        );
    }

    /** @return array<string, mixed> */
    private function captureMetadata(Media $proof): array
    {
        $metadata = $proof->metadata ?? [];
        $upload = $metadata['upload'] ?? [];
        $capture = is_array($upload) ? ($upload['capture'] ?? []) : [];

        if (! is_array($capture)) {
            return [];
        }

        $normalized = [];

        foreach ($capture as $key => $value) {
            if (is_string($key)) {
                $normalized[$key] = $value;
            }
        }

        return $normalized;
    }

    private function locationConfidence(?float $distance): int
    {
        if ($distance === null) {
            return 0;
        }

        if ($distance <= 15.0) {
            return 100;
        }

        if ($distance <= self::LOCATION_MATCH_METERS) {
            return (int) round(100 - (($distance - 15.0) / (self::LOCATION_MATCH_METERS - 15.0)) * 25);
        }

        if ($distance <= 250.0) {
            return (int) max(20, round(65 - (($distance - self::LOCATION_MATCH_METERS) / 175.0) * 45));
        }

        return 5;
    }

    private function visualConfidence(?Media $evidence, Media $proof, ?bool $locationMatch): int
    {
        if ($evidence === null) {
            return $locationMatch === true ? 58 : 35;
        }

        if ($evidence->checksum === $proof->checksum) {
            return 5;
        }

        $score = 62;

        if ($evidence->mime === $proof->mime) {
            $score += 6;
        }

        if ($evidence->width !== null && $proof->width !== null && $evidence->height !== null && $proof->height !== null) {
            $evidenceRatio = $evidence->width / max(1, $evidence->height);
            $proofRatio = $proof->width / max(1, $proof->height);
            $score += abs($evidenceRatio - $proofRatio) <= 0.35 ? 7 : -4;
        }

        if ($locationMatch === true) {
            $score += 15;
        } elseif ($locationMatch === false) {
            $score -= 25;
        }

        return max(0, min(100, $score));
    }

    /**
     * @return array{
     *   provider: string,
     *   model: string,
     *   visual_confidence: int,
     *   resolution_confidence: int,
     *   proof_matches_report: bool,
     *   needs_human_review: bool,
     *   location_risk: string,
     *   summary: string,
     *   perspective_note: string,
     *   raw: array<string, mixed>
     * }|null
     */
    private function aiReview(
        Report $report,
        ?Media $evidence,
        Media $proof,
        ?float $distance,
        int $locationConfidence,
    ): ?array {
        if ($evidence === null) {
            return null;
        }

        try {
            $prompt = PromptVersion::query()
                ->where('name', 'proof_verification')
                ->where('status', PromptVersion::STATUS_APPROVED)
                ->orderByDesc('version')
                ->first();

            $request = new AiRequest(
                promptName: 'proof_verification',
                mediaUrls: [
                    $this->mediaReferences->resolve($evidence),
                    $this->mediaReferences->resolve($proof),
                ],
                mediaTypes: [
                    $this->scalarString($evidence->mime, 'image/jpeg'),
                    $this->scalarString($proof->mime, 'image/jpeg'),
                ],
                text: $this->proofPromptContext($report, $distance, $locationConfidence),
                metadata: [
                    'report_id' => $report->id,
                    'evidence_media_id' => $evidence->id,
                    'proof_media_id' => $proof->id,
                    'distance_meters' => $distance,
                    'location_confidence' => $locationConfidence,
                ],
            );

            $response = $this->ai->execute($request, $prompt?->provider_code);
            $decoded = $this->decodedJson($response->raw);
            $sceneMatch = $this->intFrom($decoded, 'scene_match_confidence')
                ?? $response->consistencyScore
                ?? (int) round($response->confidence * 100);
            $resolution = $this->intFrom($decoded, 'resolution_confidence')
                ?? (int) round($response->confidence * 100);
            $visualConfidence = (int) round(($sceneMatch * 0.65) + ($resolution * 0.35));

            return [
                'provider' => $this->ai->lastUsedProvider->code ?? 'unknown',
                'model' => $this->ai->lastUsedProvider->model ?? 'unknown',
                'visual_confidence' => max(0, min(100, $visualConfidence)),
                'resolution_confidence' => max(0, min(100, $resolution)),
                'proof_matches_report' => $this->boolFrom($decoded, 'proof_matches_report')
                    ?? (bool) ($response->claimMatchesEvidence ?? false),
                'needs_human_review' => $this->boolFrom($decoded, 'needs_human_review')
                    ?? ($sceneMatch < 70 || $resolution < 70),
                'location_risk' => $this->stringFrom($decoded, 'location_risk', 'medium'),
                'summary' => $this->stringFrom($decoded, 'summary', $response->summary),
                'perspective_note' => $this->stringFrom(
                    $decoded,
                    'perspective_note',
                    $this->perspectiveNote($evidence, $proof),
                ),
                'raw' => $decoded,
            ];
        } catch (\Throwable $e) {
            Log::warning('department.proof_ai_review_failed', [
                'report_id' => $report->id,
                'proof_media_id' => $proof->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function proofPromptContext(Report $report, ?float $distance, int $locationConfidence): string
    {
        $location = $report->relationLoaded('location') ? $report->location : $report->location()->first();
        $address = is_string($location?->address) ? $location->address : '';
        $reportType = $report->relationLoaded('reportType') ? $report->reportType : $report->reportType()->first();
        $type = is_string($reportType?->name) ? $reportType->name : '';

        return implode("\n", [
            'Report title: '.$report->title,
            'Report description: '.$report->description,
            'Report type: '.$type,
            'Report address: '.$address,
            'Proof GPS distance from report location: '.($distance === null ? 'unavailable' : ((int) round($distance)).' meters'),
            'Location confidence: '.$locationConfidence.'/100',
            'Task: decide whether IMAGE 2 is valid completion proof for IMAGE 1 and this report.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    private function decodedJson(array $raw): array
    {
        $decoded = $raw['decoded_json'] ?? [];

        return is_array($decoded) ? $this->stringKeyed($decoded) : [];
    }

    /**
     * @param  array<array-key, mixed>  $values
     * @return array<string, mixed>
     */
    private function stringKeyed(array $values): array
    {
        $out = [];

        foreach ($values as $key => $value) {
            if (is_string($key)) {
                $out[$key] = $value;
            }
        }

        return $out;
    }

    /** @param  array<string, mixed>  $values */
    private function intFrom(array $values, string $key): ?int
    {
        $value = $values[$key] ?? null;

        return is_numeric($value) ? max(0, min(100, (int) round((float) $value))) : null;
    }

    /** @param  array<string, mixed>  $values */
    private function boolFrom(array $values, string $key): ?bool
    {
        $value = $values[$key] ?? null;

        return is_bool($value) ? $value : null;
    }

    /** @param  array<string, mixed>  $values */
    private function stringFrom(array $values, string $key, string $default): string
    {
        $value = $values[$key] ?? null;

        return is_string($value) && trim($value) !== '' ? trim($value) : $default;
    }

    private function scalarString(mixed $value, string $default): string
    {
        return is_scalar($value) ? (string) $value : $default;
    }

    private function status(int $overall, ?bool $locationMatch): string
    {
        if ($locationMatch === false || $overall < 45) {
            return 'mismatch';
        }

        if ($overall >= 75 && $locationMatch === true) {
            return 'match';
        }

        return 'needs_review';
    }

    private function summary(string $status, ?float $distance, ?bool $locationMatch, int $visualConfidence): string
    {
        if ($locationMatch === false && $distance !== null) {
            return 'Proof photo GPS is about '.(int) round($distance).' m from the report location.';
        }

        if ($locationMatch === null) {
            return 'Proof photo uploaded, but GPS metadata was not available for location matching.';
        }

        if ($status === 'match') {
            return 'Proof photo was captured near the report location and looks suitable for completion review.';
        }

        if ($visualConfidence < 55) {
            return 'Proof photo is near the report location, but the visual comparison needs officer review.';
        }

        return 'Proof photo is near the report location; review the before/after images for perspective differences.';
    }

    private function perspectiveNote(?Media $evidence, Media $proof): string
    {
        if ($evidence !== null && $evidence->checksum === $proof->checksum) {
            return 'The proof appears to reuse the original evidence image. Ask for a fresh after-work photo.';
        }

        return 'Before and after photos may be taken from different angles. The check weighs work-location GPS first, then image type, dimensions, and reuse signals before suggesting whether a human should review the perspective.';
    }

    private function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
