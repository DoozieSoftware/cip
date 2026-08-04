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
use Database\Seeders\DepartmentsSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\RoutingRulesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    $this->seed(DepartmentsSeeder::class);
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
});

it('seeds the fifteen approved Bangalore routing rules', function (): void {
    (new RoutingRulesSeeder)->run();

    expect(RoutingRule::query()->where('active', true)->count())->toBe(15);

    $this->assertDatabaseHas('routing_rules', ['name' => 'Garbage -> BBMP SWM', 'priority' => 12]);
    $this->assertDatabaseHas('routing_rules', ['name' => 'Streetlight -> BBMP Electrical', 'priority' => 14]);
    $this->assertDatabaseHas('routing_rules', ['name' => 'Illegal Parking -> BTP', 'priority' => 20]);
    $this->assertDatabaseHas('routing_rules', ['name' => 'Noise Pollution -> KSPCB', 'priority' => 24]);
});

it('upserts the approved routing destination departments', function (): void {
    (new RoutingRulesSeeder)->run();

    expect(Department::query()->where('code', 'BBMP_ENG')->exists())->toBeTrue()
        ->and(Department::query()->where('code', 'BTP')->exists())->toBeTrue()
        ->and(Department::query()->where('code', 'KSPCB')->exists())->toBeTrue();
});

it('is idempotent (re-running does not duplicate rules)', function (): void {
    (new RoutingRulesSeeder)->run();
    (new RoutingRulesSeeder)->run();

    expect(RoutingRule::query()->where('active', true)->count())->toBe(15);
});

it('routes a garbage report to BBMP SWM via the seeder', function (): void {
    (new RoutingRulesSeeder)->run();

    $garbage = ReportType::query()->where('code', 'garbage')->firstOrFail();
    $workflow = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $report = Report::factory()->create([
        'report_type_id' => $garbage->id,
        'current_status_id' => ReportStatus::query()->where('code', 'ai_processing')->firstOrFail()->id,
        'priority_id' => ReportPriority::query()->where('code', 'medium')->firstOrFail()->id,
        'workflow_id' => $workflow->id,
    ]);

    $engine = app(RoutingEngine::class);
    $decision = $engine->resolve($report);

    expect($decision)->not->toBeNull()
        ->and($decision->destinationDepartment->code)->toBe('BBMP_SWM');
});

it('routes an illegal parking report to BTP via the seeder', function (): void {
    (new RoutingRulesSeeder)->run();

    $parking = ReportType::query()->where('code', 'illegal_parking')->firstOrFail();
    $workflow = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $report = Report::factory()->create([
        'report_type_id' => $parking->id,
        'current_status_id' => ReportStatus::query()->where('code', 'ai_processing')->firstOrFail()->id,
        'priority_id' => ReportPriority::query()->where('code', 'high')->firstOrFail()->id,
        'workflow_id' => $workflow->id,
    ]);

    $engine = app(RoutingEngine::class);
    $decision = $engine->resolve($report);

    expect($decision)->not->toBeNull()
        ->and($decision->destinationDepartment->code)->toBe('BTP');
});
