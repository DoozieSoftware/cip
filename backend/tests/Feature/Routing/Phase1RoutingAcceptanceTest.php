<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Policies\DepartmentPolicy;
use App\Modules\Departments\Services\OperationDepartmentResolver;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Routing\Services\AssignmentService;
use App\Modules\Routing\Services\RoutingEngine;
use App\Modules\Routing\Services\RoutingFallbackService;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\DepartmentsSeeder;
use Database\Seeders\PromptsSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\RoutingRulesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndPermissionsSeeder::class);
    $this->seed(DepartmentsSeeder::class);
    $this->seed(ReportStatusesSeeder::class);
    $this->seed(ReportPrioritiesSeeder::class);
    $this->seed(ReportTypesSeeder::class);
    $this->seed(DefaultWorkflowSeeder::class);
    $this->seed(RoutingRulesSeeder::class);
});

dataset('phase1PrimaryRouting', [
    'T001 roads' => ['roads', 'BBMP_ENG'],
    'T002 water and sewage' => ['water_sewage', 'BWSSB'],
    'T003 electricity' => ['electricity', 'BESCOM'],
    'T004 garbage' => ['garbage', 'BBMP_SWM'],
    'T005 traffic violation' => ['traffic_violation', 'BTP'],
    'T006 illegal parking' => ['illegal_parking', 'BTP'],
    'T007 encroachment' => ['encroachment', 'BBMP_TP'],
    'T008 dead animal' => ['dead_animal', 'BBMP_SWM'],
]);

it('routes every approved Phase 1 category to its primary department', function (string $category, string $department): void {
    $report = phase1Report($category);
    $decision = app(RoutingEngine::class)->resolve($report);

    expect($decision)->not->toBeNull()
        ->and($decision->destinationDepartment->code)->toBe($department);
})->with('phase1PrimaryRouting');

it('T016 sends an unmatched category to the configured fallback', function (): void {
    $unknown = ReportType::factory()->create(['code' => 'phase1_unknown']);
    $report = phase1ReportType($unknown);

    expect(app(RoutingEngine::class)->resolve($report))->toBeNull();
    expect(app(RoutingFallbackService::class)->decisionFor($report)->destinationDepartment->code)
        ->toBe('BBMP_ENG');
});

it('routes an internal AI label before the broad category fallback', function (): void {
    $report = phase1Report('electricity');
    $report->forceFill(['ai_label' => 'streetlight'])->save();

    expect(app(RoutingEngine::class)->resolve($report)->destinationDepartment->code)
        ->toBe('BBMP_ELEC');
});

it('T017 creates exactly one primary assignment for a routed report', function (): void {
    $report = phase1Report('roads');
    $decision = app(RoutingEngine::class)->resolve($report);

    expect($decision)->not->toBeNull();
    app(AssignmentService::class)->assign($report, $decision, null, reason: 'phase1_acceptance');

    expect($report->assignments()->openPrimary()->count())->toBe(1)
        ->and($report->assignments()->where('is_primary', false)->count())->toBe(0);
});

it('T018 denies a department officer access to another department report', function (): void {
    $roads = Department::query()->where('code', 'BBMP_ENG')->firstOrFail();
    $water = Department::query()->where('code', 'BWSSB')->firstOrFail();
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($roads->id);
    $report = phase1Report('water_sewage');

    expect((new DepartmentPolicy)->view($officer, $report))->toBeFalse()
        ->and($report->department_id)->toBeNull();

    $report->department_id = $water->id;
    $report->save();

    expect((new DepartmentPolicy)->view($officer, $report))->toBeFalse();
});

it('T019 resolves an explicitly selected department for a multi-member officer', function (): void {
    $roads = Department::query()->where('code', 'BBMP_ENG')->firstOrFail();
    $water = Department::query()->where('code', 'BWSSB')->firstOrFail();
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach([$roads->id, $water->id]);

    expect(app(OperationDepartmentResolver::class)->resolve($officer, $water->id)->id)
        ->toBe($water->id);
});

it('T020 requires the Phase 1 AI routing fields in the seeded prompt', function (): void {
    $this->seed(PromptsSeeder::class);

    $prompt = DB::table('prompt_versions')
        ->where('name', 'category_classifier')
        ->where('version', 6)
        ->firstOrFail();
    $schema = json_decode((string) $prompt->expected_json_schema, true);

    expect($schema['required'])
        ->toContain('emergency_flag')
        ->toContain('secondary_triggers');
});

function phase1Report(string $category): Report
{
    return phase1ReportType(ReportType::query()->where('code', $category)->firstOrFail());
}

function phase1ReportType(ReportType $type): Report
{
    return Report::factory()->create([
        'report_type_id' => $type->id,
        'current_status_id' => ReportStatus::query()->where('code', 'ai_processing')->firstOrFail()->id,
        'priority_id' => ReportPriority::query()->where('code', 'medium')->firstOrFail()->id,
    ]);
}
