<?php

declare(strict_types=1);

use App\Modules\Settings\Console\PurgeRetentionCommand;
use App\Modules\Settings\Models\Setting;
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

// T-M9-xxx / bug #5: Data retention purge (docs/09 §25). Runs daily
// but is a no-op until each `retention.<entity>.days` setting is
// configured (missing/zero = retain forever), AND it is gated behind
// the `retention.purge_enabled` master switch so a scheduled run
// never deletes data before an operator opts in. The command also
// supports `php artisan settings:purge-retention --dry-run`.
Schedule::command(PurgeRetentionCommand::class)
    ->dailyAt('03:00')
    ->name('settings:purge-retention')
    ->withoutOverlapping()
    ->when(fn (): bool => (bool) Setting::get('retention.purge_enabled', false));
