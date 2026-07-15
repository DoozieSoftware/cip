<?php

declare(strict_types=1);

namespace App\Modules\Media\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted by `MediaService` after a photo or video asset is
 * successfully persisted to a report. The AI vision pipeline
 * (M8) subscribes to this so it can (re)start once the
 * evidence the classifier needs actually exists.
 *
 * Report creation and evidence upload are two independent API
 * calls, so a freshly submitted report may enter `ai_processing`
 * before its photo has landed. Firing this event lets the
 * orchestrator run *after* the asset is present instead of
 * burning queue retries waiting for it.
 */
final class ReportMediaUploaded
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly string $reportId,
        public readonly string $mediaId,
        public readonly string $mediaType,
    ) {}
}
