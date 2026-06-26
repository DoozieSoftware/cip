<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Services\AssignmentService;
use App\Modules\Routing\ValueObjects\RoutingDecision;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Cache::flush();

    $this->dept = Department::factory()->create();
    $this->pri = ReportPriority::factory()->create();
    $this->report = Report::factory()->create([
        'department_id' => null,
        'priority_id' => $this->pri->id,
    ]);

    $this->rule = new RoutingRule([
        'name' => 'r',
        'priority' => 100,
        'conditions' => [],
        'destination_department_id' => $this->dept->id,
        'default_officer_id' => null,
        'default_priority_id' => $this->pri->id,
        'default_sla_minutes' => 1440,
        'active' => true,
    ]);
    $this->rule->setRawAttributes(array_merge($this->rule->getAttributes(), [
        'id' => (string) Str::uuid(),
    ]));
    $this->rule->setRelation('destinationDepartment', $this->dept);
    $this->rule->setRelation('defaultPriority', $this->pri);
    $this->rule->setRelation('defaultOfficer', null);

    $this->decision = RoutingDecision::fromRule($this->rule);
    $this->service = new AssignmentService;
});

it('dispatches ReportAssigned when AssignmentService assigns a report', function (): void {
    Event::fake([ReportAssigned::class]);

    $this->service->assign($this->report, $this->decision, null);

    Event::assertDispatched(
        ReportAssigned::class,
        fn (ReportAssigned $event): bool => $event->reportId === $this->report->id
            && $event->departmentId === $this->dept->id
            && $event->slaMinutes === 1440
            && $event->actorId === null
    );
});

it('includes the assigned officer in the payload when one is picked', function (): void {
    Event::fake([ReportAssigned::class]);

    $officer = User::factory()->create();
    $decision = new RoutingDecision(
        matchedRule: $this->rule,
        destinationDepartment: $this->dept,
        defaultOfficer: $officer,
        defaultPriority: $this->pri,
        defaultSlaMinutes: 60,
    );

    $this->service->assign($this->report, $decision, null, reason: 'first routing pass');

    Event::assertDispatched(
        ReportAssigned::class,
        fn (ReportAssigned $event): bool => $event->officerId === $officer->id
            && $event->slaMinutes === 60
            && $event->reason === 'first routing pass'
    );
});

it('records the actor id on the dispatched event', function (): void {
    Event::fake([ReportAssigned::class]);

    $actor = User::factory()->create();

    $this->service->assign($this->report, $this->decision, $actor);

    Event::assertDispatched(
        ReportAssigned::class,
        fn (ReportAssigned $event): bool => $event->actorId === $actor->id
    );
});

it('event payload is serializable (roundtrips through serialize/unserialize)', function (): void {
    $actor = User::factory()->create();
    $event = new ReportAssigned(
        reportId: (string) Str::uuid(),
        departmentId: (string) Str::uuid(),
        officerId: (string) Str::uuid(),
        slaMinutes: 240,
        actorId: $actor->id,
        reason: 'routed by auto-pilot',
        metadata: ['source' => 'RoutingEngine'],
    );

    $serialized = serialize($event);
    /** @var ReportAssigned $restored */
    $restored = unserialize($serialized);

    expect($restored)->toBeInstanceOf(ReportAssigned::class)
        ->and($restored->reportId)->toBe($event->reportId)
        ->and($restored->departmentId)->toBe($event->departmentId)
        ->and($restored->officerId)->toBe($event->officerId)
        ->and($restored->slaMinutes)->toBe(240)
        ->and($restored->actorId)->toBe($actor->id)
        ->and($restored->reason)->toBe('routed by auto-pilot')
        ->and($restored->metadata)->toBe(['source' => 'RoutingEngine']);
});
