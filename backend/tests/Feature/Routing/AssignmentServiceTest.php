<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Services\AssignmentService;
use App\Modules\Routing\ValueObjects\RoutingDecision;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Cache::flush();

    $this->dept = Department::factory()->create();
    $this->pri = ReportPriority::factory()->create();
    $this->officerA = User::factory()->create();
    $this->officerB = User::factory()->create();

    DB::table('department_users')->insert([
        'id' => (string) Str::uuid(),
        'user_id' => $this->officerA->id,
        'department_id' => $this->dept->id,
        'is_manager' => false,
        'assigned_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('department_users')->insert([
        'id' => (string) Str::uuid(),
        'user_id' => $this->officerB->id,
        'department_id' => $this->dept->id,
        'is_manager' => false,
        'assigned_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

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

it('writes a report_assignments row', function (): void {
    $assignment = $this->service->assign($this->report, $this->decision, null);

    expect(ReportAssignment::query()->where('id', $assignment->id)->exists())->toBeTrue()
        ->and($assignment->report_id)->toBe($this->report->id)
        ->and($assignment->department_id)->toBe($this->dept->id);
});

it('mirrors the routing decision onto the report', function (): void {
    $this->service->assign($this->report, $this->decision, null);

    $fresh = $this->report->fresh();
    expect($fresh->department_id)->toBe($this->dept->id)
        ->and($fresh->priority_id)->toBe($this->pri->id);
});

it('records the actor in the assigned_by column', function (): void {
    $actor = User::factory()->create();
    $assignment = $this->service->assign($this->report, $this->decision, $actor);
    expect($assignment->assigned_by)->toBe($actor->id);
});

it('uses the default officer from the rule when present', function (): void {
    $decision = new RoutingDecision(
        matchedRule: $this->rule,
        destinationDepartment: $this->dept,
        defaultOfficer: $this->officerA,
        defaultPriority: $this->pri,
        defaultSlaMinutes: 1440,
    );

    $assignment = $this->service->assign($this->report, $decision, null);
    expect($assignment->officer_id)->toBe($this->officerA->id);
});

it('round-robin cycles deterministically through department officers', function (): void {
    $first = $this->service->pickOfficer($this->dept->id);
    $second = $this->service->pickOfficer($this->dept->id);
    $third = $this->service->pickOfficer($this->dept->id);
    $fourth = $this->service->pickOfficer($this->dept->id);

    expect($first->id)->not->toBe($second->id)
        ->and($third->id)->toBe($first->id) // wrapped
        ->and($fourth->id)->toBe($second->id);
});

it('round-robin uses the same cursor across AssignmentService instances', function (): void {
    $svc1 = new AssignmentService;
    $svc2 = new AssignmentService;

    $a = $svc1->pickOfficer($this->dept->id);
    $b = $svc2->pickOfficer($this->dept->id);

    expect($a->id)->not->toBe($b->id);
});

it('returns null when the department has no officers', function (): void {
    $emptyDept = Department::factory()->create();
    $decision = new RoutingDecision(
        matchedRule: $this->rule,
        destinationDepartment: $emptyDept,
        defaultOfficer: null,
        defaultPriority: $this->pri,
        defaultSlaMinutes: 1440,
    );
    $this->rule->setRelation('destinationDepartment', $emptyDept);

    $assignment = $this->service->assign($this->report, $decision, null);
    expect($assignment->officer_id)->toBeNull();
});

it('falls back to a round-robin officer when the rule has no default officer', function (): void {
    $assignment = $this->service->assign($this->report, $this->decision, null);
    expect($assignment->officer_id)->not->toBeNull()
        ->and($assignment->officer_id)->toBeIn([$this->officerA->id, $this->officerB->id]);
});
