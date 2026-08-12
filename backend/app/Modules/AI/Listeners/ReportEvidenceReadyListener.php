<?php

declare(strict_types=1);

namespace App\Modules\AI\Listeners;

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\Reports\Events\ReportEvidenceReady;
use App\Modules\Reports\Models\Report;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

/** Dispatches exactly one report/revision-scoped AI job. */
final class ReportEvidenceReadyListener implements ShouldQueue
{
    use InteractsWithQueue;

    public function handle(ReportEvidenceReady $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null || $report->status?->code !== 'ai_processing') {
            return;
        }

        if (! PromptVersion::query()->where('name', 'category_classifier')->where('status', PromptVersion::STATUS_APPROVED)->exists()
            || ! AiProviderConfig::query()->where('active', true)->exists()) {
            return;
        }

        AiPipelineOrchestrator::dispatch($report->id, $event->revision);
    }
}
