<?php

declare(strict_types=1);

namespace App\Modules\AI\Listeners;

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\Models\AiJob;
use App\Modules\Media\Events\ReportMediaUploaded;
use App\Modules\Reports\Models\Report;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

/**
 * Re-arms the M8 vision pipeline when vision-classifiable
 * evidence (a photo or video) is uploaded to a report that is
 * already sitting in `ai_processing`.
 *
 * Why this is needed: `ReportSubmittedListener` dispatches the
 * orchestrator the instant the report reaches `ai_processing`,
 * but the citizen PWA uploads the photo/video as a *separate*
 * API call that almost always arrives afterwards. The
 * orchestrator refuses to run without evidence and (with a
 * short retry budget) can exhaust its attempts before the
 * upload lands — leaving the report stranded in
 * `ai_processing` forever. Hearing this event lets the job run
 * once the asset actually exists.
 *
 * The listener also runs when the upload is the *first* evidence
 * for a report whose orchestrator already failed; a fresh
 * dispatch re-enters the pipeline and now succeeds.
 */
class ReportMediaUploadedListener implements ShouldQueue
{
    use InteractsWithQueue;

    public function handle(ReportMediaUploaded $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null) {
            return;
        }

        if ($report->refresh()->status?->code !== 'ai_processing') {
            return;
        }

        // Don't re-arm an already-completed pipeline — a successful
        // run means the AI result is good; re-running would only
        // clobber it with a duplicate job.
        $alreadySucceeded = AiJob::query()
            ->where('report_id', $report->id)
            ->where('status', AiJob::STATUS_SUCCEEDED)
            ->exists();

        if ($alreadySucceeded) {
            return;
        }

        AiPipelineOrchestrator::dispatch($report->id);
    }
}
