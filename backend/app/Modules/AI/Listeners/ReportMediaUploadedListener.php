<?php

declare(strict_types=1);

namespace App\Modules\AI\Listeners;

use App\Modules\Media\Events\ReportMediaUploaded;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

/**
 * Deprecated compatibility listener. AI is dispatched only from the
 * report-scoped ReportEvidenceReady event after finalization.
 */
class ReportMediaUploadedListener implements ShouldQueue
{
    use InteractsWithQueue;

    public function handle(ReportMediaUploaded $event): void
    {
        Log::debug('ai.ReportMediaUploadedListener: ignored; evidence finalization is required', [
            'report_id' => $event->reportId,
            'media_id' => $event->mediaId,
        ]);
    }
}
