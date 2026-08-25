<?php

declare(strict_types=1);

use App\Modules\Workflow\Jobs\CheckSlaBreaches;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // The withSchedule() callback in bootstrap/app.php only executes when
    // the console kernel actually builds the schedule (schedule:run /
    // schedule:list in a real process). In-process tests start with an
    // empty Schedule::events(); building it via an in-process artisan call
    // mirrors what `php artisan schedule:list` does and registers the same
    // singleton instance the facade exposes.
    Artisan::call('schedule:list');
});

it('CheckSlaBreaches is registered to run every 5 minutes', function (): void {
    $match = null;

    foreach (Schedule::events() as $event) {
        if (($event->description ?? '') === 'workflow:check-sla-breaches') {
            $match = $event;
            break;
        }
    }

    expect($match)->not->toBeNull('CheckSlaBreaches is not registered with the scheduler');
    expect($match->expression)->toBe('*/5 * * * *');
});

it('CheckSlaBreaches has the workflow:check-sla-breaches description', function (): void {
    $match = null;

    foreach (Schedule::events() as $event) {
        if (str_contains((string) ($event->description ?? ''), 'workflow:check-sla-breaches')) {
            $match = $event;
            break;
        }
    }

    expect($match)->not->toBeNull();
    expect($match->description)->toBe('workflow:check-sla-breaches');
});

it('CheckSlaBreaches runs without overlapping', function (): void {
    $match = null;

    foreach (Schedule::events() as $event) {
        if (str_contains((string) ($event->description ?? ''), 'workflow:check-sla-breaches')) {
            $match = $event;
            break;
        }
    }

    expect($match)->not->toBeNull();
    expect($match->withoutOverlapping)->toBeTrue();
});

it('php artisan schedule:list renders the CheckSlaBreaches entry', function (): void {
    $exit = 0;
    $output = [];
    exec('cd '.base_path().' && php artisan schedule:list 2>&1', $output, $exit);

    expect($exit)->toBe(0);
    $combined = implode("\n", $output);
    // Laravel renders the schedule table with padded columns
    // (e.g. "*/5  * * * *"), so collapse whitespace before matching.
    $normalized = (string) preg_replace('/\s+/', ' ', $combined);
    expect($normalized)->toContain('workflow:check-sla-breaches')
        ->and($normalized)->toContain('*/5 * * * *');
});

it('the CheckSlaBreaches class is loadable from the registered callback', function (): void {
    $match = null;

    foreach (Schedule::events() as $event) {
        if (str_contains((string) ($event->description ?? ''), 'workflow:check-sla-breaches')) {
            $match = $event;
            break;
        }
    }

    expect($match)->not->toBeNull();
    expect(class_exists(CheckSlaBreaches::class))->toBeTrue();
});
