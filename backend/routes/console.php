<?php

declare(strict_types=1);

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\Reports\Models\Report;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function (): void {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('ai:reprocess-reports {--date= : Report submitted date (YYYY-MM-DD), defaults to today} {--dry-run : Count matching reports without dispatching jobs} {--sync : Run jobs inline instead of queueing}', function (): int {
    $dateInput = (string) ($this->option('date') ?: today()->toDateString());

    try {
        $date = CarbonImmutable::createFromFormat('Y-m-d', $dateInput);
    } catch (Throwable) {
        $this->error('Invalid --date value. Use YYYY-MM-DD.');

        return self::FAILURE;
    }

    if ($date === false) {
        $this->error('Invalid --date value. Use YYYY-MM-DD.');

        return self::FAILURE;
    }

    $query = Report::query()
        ->where(function ($query) use ($date): void {
            $query->whereDate('submitted_at', $date->toDateString())
                ->orWhere(function ($query) use ($date): void {
                    $query->whereNull('submitted_at')
                        ->whereDate('created_at', $date->toDateString());
                });
        })
        ->orderBy('id');

    $count = (clone $query)->count();
    $this->info("Matched {$count} report(s) for {$date->toDateString()}.");

    if ($this->option('dry-run')) {
        return self::SUCCESS;
    }

    $sync = (bool) $this->option('sync');
    $bar = $this->output->createProgressBar($count);

    $query->select('id')->chunkById(100, function ($reports) use ($sync, $bar): void {
        foreach ($reports as $report) {
            if ($sync) {
                AiPipelineOrchestrator::dispatchSync($report->id);
            } else {
                AiPipelineOrchestrator::dispatch($report->id);
            }

            $bar->advance();
        }
    });

    $bar->finish();
    $this->newLine();
    $this->info($sync ? 'Reprocessing finished.' : 'Reprocessing jobs queued.');

    return self::SUCCESS;
})->purpose('Re-run the AI pipeline for reports submitted on a given date');
