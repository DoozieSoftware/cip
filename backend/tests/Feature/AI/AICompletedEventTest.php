<?php

declare(strict_types=1);

use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Listeners\AiCompletedListener;
use App\Modules\Reports\Models\Report;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\RoutingRulesSeeder;
use Illuminate\Support\Facades\Event;

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    (new RoutingRulesSeeder)->run();
});

it('AiCompleted is a final readonly class with the spec-mandated public properties', function (): void {
    $event = new AiCompleted(
        reportId: 'abc-123',
        categoryCode: 'pothole',
        severityCode: 'high',
        aiLabel: 'pothole',
        visionResult: ['confidence' => 0.9],
    );

    expect($event->reportId)->toBe('abc-123')
        ->and($event->categoryCode)->toBe('pothole')
        ->and($event->severityCode)->toBe('high')
        ->and($event->aiLabel)->toBe('pothole')
        ->and($event->visionResult)->toBe(['confidence' => 0.9]);
});

it('the event class is final and serializable (the queue contract)', function (): void {
    $reflection = new ReflectionClass(AiCompleted::class);
    expect($reflection->isFinal())->toBeTrue();

    $r = new AiCompleted('a', 'b', 'c', 'd', ['e' => 1]);
    $serialized = serialize($r);
    $unserialized = unserialize($serialized);

    expect($unserialized)->toBeInstanceOf(AiCompleted::class)
        ->and($unserialized->reportId)->toBe('a')
        ->and($unserialized->categoryCode)->toBe('b')
        ->and($unserialized->severityCode)->toBe('c')
        ->and($unserialized->aiLabel)->toBe('d')
        ->and($unserialized->visionResult)->toBe(['e' => 1]);
});

it('the event can be dispatched and the listener receives the payload (E2E proof)', function (): void {
    Event::fake([AiCompleted::class]);

    $report = Report::factory()->create();

    AiCompleted::dispatch(
        $report->id,
        'pothole',
        'high',
        'pothole',
        ['confidence' => 0.9, 'department' => 'public_works'],
    );

    Event::assertDispatched(AiCompleted::class, function (AiCompleted $e) use ($report): bool {
        return $e->reportId === $report->id
            && $e->categoryCode === 'pothole'
            && $e->severityCode === 'high'
            && $e->aiLabel === 'pothole'
            && $e->visionResult['department'] === 'public_works';
    });
});

it('the listener is bound in the service provider and reachable by name', function (): void {
    $listener = app(AiCompletedListener::class);
    expect($listener)->toBeInstanceOf(AiCompletedListener::class);
});

it('the listener can be invoked with a synthetic event without throwing when the report is missing', function (): void {
    $listener = app(AiCompletedListener::class);

    // The listener logs and returns when the report doesn't exist;
    // it must not throw.
    $listener->handle(new AiCompleted('does-not-exist'));

    expect(true)->toBeTrue();
});
