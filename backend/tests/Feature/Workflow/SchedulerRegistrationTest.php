<?php

declare(strict_types=1);

use App\Modules\Workflow\Jobs\CheckSlaBreaches;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schedule;

uses(RefreshDatabase::class);

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
    expect($combined)->toContain('workflow:check-sla-breaches')
        ->and($combined)->toContain('*/5 * * * *');
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
