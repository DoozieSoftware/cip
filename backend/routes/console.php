<?php

declare(strict_types=1);

use App\Modules\Workflow\Jobs\CheckSlaBreaches;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function (): void {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// T-M6-015: Scan workflow reports every 5 minutes for SLA
// breaches and emit SlaBreached events. The job is
// idempotent and never mutates state; downstream
// notifications (M9) consume the event.
Schedule::job(new CheckSlaBreaches)
    ->everyFiveMinutes()
    ->name('workflow:check-sla-breaches')
    ->withoutOverlapping();
