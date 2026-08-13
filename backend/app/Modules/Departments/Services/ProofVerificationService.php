<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\Departments\Models\ReportProofVerification;
use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Support\Carbon;

class ProofVerificationService
{
    private const LOCATION_MATCH_METERS = 75.0;

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
        $overall = (int) round(($locationConfidence * 0.55) + ($visualConfidence * 0.45));
        $status = $this->status($overall, $locationMatch);

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
                'summary' => $this->summary($status, $distance, $locationMatch, $visualConfidence),
                'perspective_note' => $this->perspectiveNote($evidence, $proof),
                'metadata' => [
                    'engine' => 'proof_validation_v1',
                    'location_match_threshold_m' => self::LOCATION_MATCH_METERS,
                    'proof_capture' => $this->captureMetadata($proof),
                    'evidence_media_present' => $evidence !== null,
                    'same_file_reused' => $evidence !== null && $evidence->checksum === $proof->checksum,
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
