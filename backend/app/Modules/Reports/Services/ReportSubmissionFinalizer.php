<?php

declare(strict_types=1);

namespace App\Modules\Reports\Services;

use App\Modules\Reports\DTO\ReportFinalizationResult;
use App\Modules\Reports\Events\ReportEvidenceReady;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;

final class ReportSubmissionFinalizer
{
    public function __construct(
        private readonly ReportService $reports,
        private readonly EvidenceManifestService $evidence,
    ) {}

    public function finalize(Report $report, User $actor): ReportFinalizationResult
    {
        $submittedStatusId = $this->reports->resolveStatusId('submitted');
        $draftStatusId = $this->reports->resolveStatusId('draft');

        if ((string) $report->current_status_id === $submittedStatusId) {
            return new ReportFinalizationResult($report, true);
        }

        if ((string) $report->current_status_id !== $draftStatusId) {
            throw new ApiException('INVALID_STATUS', 'Only draft reports can be finalized.', 422);
        }

        $manifest = $this->evidence->manifest($report);

        if (! $manifest['ready']) {
            throw new ApiException(
                'EVIDENCE_NOT_READY',
                'Required evidence must finish uploading and hashing before submission.',
                409,
                $manifest,
            );
        }

        $revision = $manifest['revision'] ?? null;

        if (! is_string($revision)) {
            throw new ApiException('EVIDENCE_NOT_READY', 'Evidence revision is missing.', 409, $manifest);
        }

        $report = $this->reports->transitionTo(
            $report,
            $submittedStatusId,
            (string) $actor->id,
            'Citizen finalized evidence-backed report.',
            ['source' => 'citizen_finalize_endpoint', 'evidence_revision' => $revision],
        );
        $report->submitted_at = now();
        $report->save();

        ReportEvidenceReady::dispatch(
            $report->id,
            $revision,
            $this->mediaIds($manifest['assets'] ?? []),
        );

        $fresh = $report->fresh();

        if ($fresh === null) {
            throw ApiException::notFound('Complaint');
        }

        return new ReportFinalizationResult($fresh, false);
    }

    /**
     * @return list<string>
     */
    private function mediaIds(mixed $assets): array
    {
        if (! is_array($assets)) {
            return [];
        }

        $ids = [];

        foreach ($assets as $asset) {
            if (is_array($asset) && is_string($asset['id'] ?? null)) {
                $ids[] = $asset['id'];
            }
        }

        return $ids;
    }
}
