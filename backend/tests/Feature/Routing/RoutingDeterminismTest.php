<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Services\RoutingEngine;
use App\Modules\Workflow\Models\WorkflowDefinition;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();

    $this->deptA = Department::factory()->create(['name' => 'BBMP Ward 112']);
    $this->deptB = Department::factory()->create(['name' => 'BBMP Ward 113']);
    $this->deptC = Department::factory()->create(['name' => 'BTP']);
    $this->medium = ReportPriority::query()->where('code', 'medium')->firstOrFail();

    $this->garbage = ReportType::query()->where('code', 'garbage')->firstOrFail();
    $this->pothole = ReportType::query()->where('code', 'pothole')->firstOrFail();

    $workflow = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();

    $this->report = Report::factory()->create([
        'report_type_id' => $this->garbage->id,
        'current_status_id' => ReportStatus::query()->where('code', 'ai_processing')->firstOrFail()->id,
        'priority_id' => $this->medium->id,
        'workflow_id' => $workflow->id,
    ]);
});

it('returns identical decisions for 50 consecutive calls on the same input', function (): void {
    RoutingRule::factory()->create([
        'name' => 'Garbage -> A',
        'priority' => 10,
        'conditions' => ['category_in' => ['garbage']],
        'destination_department_id' => $this->deptA->id,
        'default_priority_id' => $this->medium->id,
        'default_sla_minutes' => 60,
        'active' => true,
    ]);

    $engine = app(RoutingEngine::class);
    $first = $engine->resolve($this->report);

    expect($first)->not->toBeNull();
    $firstId = $first->matchedRule->id;

    for ($i = 0; $i < 50; $i++) {
        $next = $engine->resolve($this->report);
        expect($next)->not->toBeNull()
            ->and($next->matchedRule->id)->toBe($firstId)
            ->and($next->destinationDepartment->id)->toBe($first->destinationDepartment->id);
    }
});

it('returns the lowest-priority rule first when multiple rules match', function (): void {
    $a = RoutingRule::factory()->create([
        'name' => 'Higher priority (lower number)',
        'priority' => 10,
        'conditions' => ['category_in' => ['garbage']],
        'destination_department_id' => $this->deptA->id,
        'default_priority_id' => $this->medium->id,
        'default_sla_minutes' => 60,
        'active' => true,
    ]);
    $b = RoutingRule::factory()->create([
        'name' => 'Lower priority (higher number)',
        'priority' => 100,
        'conditions' => ['category_in' => ['garbage']],
        'destination_department_id' => $this->deptB->id,
        'default_priority_id' => $this->medium->id,
        'default_sla_minutes' => 120,
        'active' => true,
    ]);
    $c = RoutingRule::factory()->create([
        'name' => 'Even lower',
        'priority' => 200,
        'conditions' => ['category_in' => ['garbage']],
        'destination_department_id' => $this->deptC->id,
        'default_priority_id' => $this->medium->id,
        'default_sla_minutes' => 240,
        'active' => true,
    ]);

    $engine = app(RoutingEngine::class);
    $decision = $engine->resolve($this->report);

    expect($decision->matchedRule->id)->toBe($a->id)
        ->and($decision->destinationDepartment->id)->toBe($this->deptA->id);
});

it('breaks priority ties by id (uuid-lexicographic ascending)', function (): void {
    // Two rules with the same priority; the one whose
    // id sorts first lexicographically should win.
    $r1 = RoutingRule::factory()->create([
        'name' => 'Tie A',
        'priority' => 50,
        'conditions' => ['category_in' => ['garbage']],
        'destination_department_id' => $this->deptA->id,
        'default_priority_id' => $this->medium->id,
        'default_sla_minutes' => 60,
        'active' => true,
    ]);
    $r2 = RoutingRule::factory()->create([
        'name' => 'Tie B',
        'priority' => 50,
        'conditions' => ['category_in' => ['garbage']],
        'destination_department_id' => $this->deptB->id,
        'default_priority_id' => $this->medium->id,
        'default_sla_minutes' => 60,
        'active' => true,
    ]);

    $engine = app(RoutingEngine::class);
    $decision = $engine->resolve($this->report);

    $expectedWinner = strcmp($r1->id, $r2->id) < 0 ? $r1->id : $r2->id;
    expect($decision->matchedRule->id)->toBe($expectedWinner);
});

it('skips inactive rules and continues to the next active match', function (): void {
    RoutingRule::factory()->create([
        'name' => 'Inactive but matches',
        'priority' => 1,
        'conditions' => ['category_in' => ['garbage']],
        'destination_department_id' => $this->deptA->id,
        'default_priority_id' => $this->medium->id,
        'default_sla_minutes' => 60,
        'active' => false,
    ]);
    $active = RoutingRule::factory()->create([
        'name' => 'Active',
        'priority' => 100,
        'conditions' => ['category_in' => ['garbage']],
        'destination_department_id' => $this->deptB->id,
        'default_priority_id' => $this->medium->id,
        'default_sla_minutes' => 60,
        'active' => true,
    ]);

    $engine = app(RoutingEngine::class);
    $decision = $engine->resolve($this->report);

    expect($decision->matchedRule->id)->toBe($active->id);
});
