<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Http\Resources;

use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Services\AiReviewGate;
use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Models\ReportProofVerification;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Support\MediaUrl;
use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Moderator-portal report detail — extends the shared ReportResource
 * with the fields the moderator UI needs (evidence, AI result, audit
 * trail, status history, active assignment) that the base resource
 * intentionally omits for lighter-weight consumers.
 *
 * Field names/shapes here are dictated by what
 * frontend/src/portals/moderator/types/index.ts (ReportDetail,
 * MediaItem, AiResult, GeoPoint) and the components that read them
 * (EvidenceViewer, AiAnalysisPanel) actually expect — not by what the
 * underlying tables happen to be called.
 *
 * @property-read Report $resource
 */
class ModeratorReportDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $report = $this->resource;
        $base = (new ReportResource($report))->toArray($request);

        $department = $report->relationLoaded('department') ? $report->department : $report->department()->first();
        $location = $report->relationLoaded('location') ? $report->location : $report->location()->first();

        $media = Media::query()->where('report_id', $report->id)->orderBy('captured_at')->get();
        $mediaUrl = new MediaUrl;

        $latestJob = AiJob::query()
            ->where('report_id', $report->id)
            ->with(['result.labels', 'promptVersion'])
            ->latest('created_at')
            ->first();

        $activeAssignment = ReportAssignment::query()
            ->where('report_id', $report->id)
            ->whereNull('reassigned_at')
            ->with('officer')
            ->latest('assigned_at')
            ->first();

        $proofReview = ReportProofVerification::query()
            ->where('report_id', $report->id)
            ->whereHas('proofMedia', fn ($query) => $query->where('is_replaced', false))
            ->latest('checked_at')
            ->first();

        $auditLogs = AuditLog::query()
            ->where('entity_id', $report->id)
            ->with('user')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $statusHistory = $report->relationLoaded('statusHistory')
            ? $report->statusHistory
            : $report->statusHistory()->with(['fromStatus', 'toStatus', 'actor'])->orderBy('created_at')->get();

        // array_merge, not `+` — the override array's `location` must win
        // over the base resource's fuller (and differently-shaped) one.
        return array_merge($base, [
            'category' => $base['report_type'],
            'status_code' => is_array($base['status'] ?? null) ? ($base['status']['code'] ?? null) : null,
            'department' => $department === null ? null : [
                'id' => $department->id,
                'code' => $department->code,
                'name' => $department->name,
            ],
            'ward' => $location?->ward?->name,
            'district' => $location?->district?->name,
            'evidence_count' => $media->count(),
            // GeoPoint shape — the base resource's own `location` key
            // (kept above, unmodified) carries the fuller address/accuracy
            // detail for anyone that wants it.
            'location' => $location === null ? null : [
                'lat' => (float) $location->latitude,
                'lng' => (float) $location->longitude,
            ],
            'media' => $media->map(fn (Media $m): array => [
                'id' => $m->id,
                'mime_type' => $m->mime,
                'url' => $mediaUrl->temporary($m),
                'width' => $m->width,
                'height' => $m->height,
                'duration_seconds' => $m->duration,
                'captured_at' => $m->captured_at?->toIso8601String(),
            ])->all(),
            'ai_result' => $this->buildAiResult($latestJob, $report),
            'proof_review' => $proofReview === null ? null : [
                'id' => $proofReview->id,
                'status' => $proofReview->status,
                'overall_confidence' => $proofReview->overall_confidence,
                'location_confidence' => $proofReview->location_confidence,
                'visual_confidence' => $proofReview->visual_confidence,
                'location_match' => $proofReview->location_match,
                'distance_meters' => $proofReview->distance_meters,
                'summary' => $proofReview->summary,
                'perspective_note' => $proofReview->perspective_note,
                'checked_at' => $proofReview->checked_at->toIso8601String(),
            ],
            'assigned_to' => $activeAssignment?->officer === null ? null : [
                'id' => $activeAssignment->officer->id,
                'name' => $activeAssignment->officer->name,
            ],
            'audit_log' => $auditLogs->map(fn (AuditLog $a): array => [
                'id' => $a->id,
                'actor_id' => $a->user_id,
                'actor_name' => $a->user?->name,
                'action' => $a->action,
                'payload' => $a->after,
                'created_at' => $a->created_at->toIso8601String(),
            ])->all(),
            'status_history' => $statusHistory->map(fn ($h): array => [
                'from_code' => $h->fromStatus?->code,
                'to_code' => $h->toStatus?->code,
                'actor_id' => $h->actor_id,
                'actor_name' => isset($h->actor)
                    ? ($h->actor->name ?? self::actorRoleTitle($h->actor) ?? ($h->actor_id ? 'Official' : 'System'))
                    : ($h->actor_id ? 'Official' : 'System'),
                'reason' => $h->reason,
                'created_at' => $h->created_at?->toIso8601String(),
            ])->all(),
        ]);
    }

    /**
     * Human title for an actor whose account has no display name (e.g. an
     * OTP-only citizen). Every account also carries the baseline `citizen`
     * role, so a staff-privileged role is ranked above it rather than
     * picked arbitrarily.
     */
    private static function actorRoleTitle(?User $actor): ?string
    {
        if ($actor === null) {
            return null;
        }

        $roles = $actor->getRoleNames()->all();
        $priority = ['system', 'super_admin', 'moderator', 'department_officer', 'department', 'citizen'];
        $role = null;

        foreach ($priority as $candidate) {
            if (in_array($candidate, $roles, true)) {
                $role = $candidate;
                break;
            }
        }

        return match ($role) {
            'citizen' => 'Citizen',
            'moderator' => 'Moderator',
            'department_officer', 'department' => 'Department Officer',
            'super_admin' => 'Admin',
            'system' => 'System',
            default => null,
        };
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildAiResult(?AiJob $job, Report $report): ?array
    {
        $result = $job?->result;

        if ($job === null || $result === null) {
            return null;
        }

        // predicted_type / recommended_department are stored as codes on
        // ai_results — the frontend wants the same {id, code, name} shape
        // it gets for the report's own category/department.
        $category = ReportType::query()->where('code', $result->predicted_type)->first();
        $department = $result->recommended_department === null
            ? null
            : Department::query()->where('code', $result->recommended_department)->first();

        // The AI prompt suggests a generic functional category (e.g.
        // "animal_welfare", "sanitation") — this deployment's real
        // departments are civic-body acronyms (BBMP, BWSSB, BESCOM, BTP)
        // that don't share that vocabulary, so the lookup above almost
        // always misses. Surface the AI's raw suggestion as an unresolved
        // hint (id: null) rather than silently dropping it — losing it
        // entirely is worse than showing something that isn't a routable
        // department id. The moderator always picks the actual department
        // manually regardless (AGENTS.md "moderator always overrides AI").
        if ($department === null && $result->recommended_department !== null) {
            $department = null;
            $unresolvedDepartmentHint = [
                'id' => null,
                'code' => $result->recommended_department,
                'name' => str_replace('_', ' ', $result->recommended_department),
            ];
        } else {
            $unresolvedDepartmentHint = null;
        }

        $confidence = $result->confidence === null ? 0.0 : (float) $result->confidence * 100;
        $reviewReasons = app(AiReviewGate::class)->reasons(
            confidencePercent: $confidence,
            duplicateScore: $result->duplicate_score,
            fraudScore: $result->fraud_score,
            claimMatchesEvidence: $result->claim_matches_evidence,
            consistencyScore: $result->consistency_score,
            syntheticScore: $result->synthetic_score,
            mockGpsScore: $report->mock_gps_score,
        );

        return [
            'job_id' => $job->id,
            'provider_code' => $job->provider_code,
            'prompt_version' => $job->promptVersion?->version,
            // ai_results.confidence is a 0..1 float; the moderator UI's
            // Stat/pct() helper rounds and appends "%" directly, so this
            // needs to be on the same 0..100 scale as fraud_score/
            // duplicate_score/quality_score.
            'confidence' => $result->confidence === null ? null : $result->confidence * 100,
            'review_required' => $reviewReasons !== [],
            'review_reasons' => $reviewReasons,
            'recommended_category' => $category === null ? null : [
                'id' => $category->id,
                'code' => $category->code,
                'name' => $category->name,
            ],
            'recommended_department' => $department !== null ? [
                'id' => $department->id,
                'code' => $department->code,
                'name' => $department->name,
            ] : $unresolvedDepartmentHint,
            'labels' => $result->labels->map(fn ($l): array => [
                'id' => $l->id,
                'code' => $l->label,
                'name' => $l->label,
                'confidence' => (float) $l->confidence * 100,
            ])->all(),
            'fraud_score' => $result->fraud_score,
            'duplicate_score' => $result->duplicate_score,
            'quality_score' => $result->quality_score,
            'notes' => $result->summary,
            'license_plate' => $result->license_plate,
            'plate_confidence' => $result->plate_confidence,
            'claim_matches_evidence' => $result->claim_matches_evidence,
            'consistency_score' => $result->consistency_score,
            'mismatch_reason' => $result->mismatch_reason,
            'synthetic_score' => $result->synthetic_score,
            'created_at' => $result->created_at->toIso8601String(),
        ];
    }
}
