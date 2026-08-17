<?php

declare(strict_types=1);

use App\Modules\AI\Events\AiCompleted;
use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

it('requires moderator review when duplicate risk is high despite auto-route confidence', function (): void {
    Event::fake([ReportAssigned::class]);
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new RolesAndPermissionsSeeder)->run();
    (new DefaultWorkflowSeeder)->run();

    $department = Department::factory()->create(['name' => 'Greater Bengaluru Authority']);
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $type = ReportType::factory()->create();
    $workflow = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $report = Report::factory()->create([
        'citizen_id' => User::factory()->create()->id,
        'report_type_id' => $type->id,
        'current_status_id' => ReportStatus::query()->where('code', 'ai_processing')->firstOrFail()->id,
        'department_id' => null,
        'priority_id' => $priority->id,
        'ai_label' => 'roads',
        'workflow_id' => $workflow->id,
        'duplicate_score' => 100,
        'fraud_score' => 25,
    ]);
    RoutingRule::factory()->create([
        'name' => 'Catch-all',
        'priority' => 100,
        'conditions' => [],
        'destination_department_id' => $department->id,
        'default_officer_id' => null,
        'default_priority_id' => $priority->id,
        'default_sla_minutes' => 60,
        'active' => true,
    ]);

    AiCompleted::dispatch(
        reportId: $report->id,
        aiLabel: 'roads',
        visionResult: ['confidence' => 0.98],
    );

    expect(ReportAssignment::query()->where('report_id', $report->id)->count())->toBe(0)
        ->and(ReportStatus::query()->find($report->fresh()->current_status_id)?->code)
        ->toBe('pending_moderator');
    Event::assertNotDispatched(ReportAssigned::class);
});
