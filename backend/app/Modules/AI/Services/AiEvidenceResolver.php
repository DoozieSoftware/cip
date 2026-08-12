<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\Exceptions\AiEvidenceNotReadyException;
use App\Modules\AI\ValueObjects\AiEvidenceBundle;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Services\EvidenceManifestService;

final class AiEvidenceResolver
{
    public function __construct(
        private readonly EvidenceManifestService $manifests,
    ) {}

    public function resolve(string $reportId, ?string $expectedRevision): AiEvidenceBundle
    {
        $report = Report::query()->findOrFail($reportId);
        $manifest = $this->manifests->manifest($report);

        if (($manifest['ready'] ?? false) !== true) {
            throw new AiEvidenceNotReadyException;
        }

        $revision = $manifest['revision'] ?? null;

        if (! is_string($revision)) {
            throw new AiEvidenceNotReadyException;
        }

        if ($expectedRevision !== null && ! hash_equals($expectedRevision, $revision)) {
            throw new AiEvidenceNotReadyException;
        }

        $media = Media::query()
            ->whereIn('id', $this->mediaIds($manifest['assets'] ?? []))
            ->where('role', 'evidence')
            ->where('is_replaced', false)
            ->whereIn('type', ['PHOTO', 'VIDEO'])
            ->orderBy('uploaded_at')
            ->get();

        if ($media->isEmpty()) {
            throw new AiEvidenceNotReadyException;
        }

        return new AiEvidenceBundle($report, $media, $revision);
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
