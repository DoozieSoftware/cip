<?php

declare(strict_types=1);

use App\Modules\AI\Events\AiCompleted;
use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Services\SecondaryRoutingService;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Settings\Models\AppConfig;
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

beforeEach(function (): void {
    Event::fake([ReportAssigned::class]);
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();

    $this->primaryDepartment = Department::factory()->create([
        'code' => 'TEST_PRIMARY_ENGINEERING',
        'default_sla_minutes' => 1440,
    ]);
    $this->secondaryDepartment = Department::factory()->create([
        'code' => 'TEST_SECONDARY_TRAFFIC',
        'default_sla_minutes' => 480,
    ]);
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $workflow = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();

    $this->report = Report::factory()->create([
        'department_id' => $this->primaryDepartment->id,
        'priority_id' => $priority->id,
        'workflow_id' => $workflow->id,
        'current_status_id' => $assigned->id,
    ]);
    $this->primaryAssignment = ReportAssignment::query()->create([
        'report_id' => $this->report->id,
        'department_id' => $this->primaryDepartment->id,
        'is_primary' => true,
        'kind' => ReportAssignment::KIND_PRIMARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 1440,
    ]);
    $this->actor = User::factory()->create();
});

it('creates an idempotent secondary task from the configurable trigger map', function (): void {
    AppConfig::query()->create([
        'key' => SecondaryRoutingService::APP_CONFIG_KEY,
        'value' => ['traffic_obstruction' => $this->secondaryDepartment->code],
        'enabled' => true,
        'rollout_percentage' => 100,
        'cohort' => null,
    ]);

    $service = app(SecondaryRoutingService::class);
    $created = $service->route($this->report, ['traffic_obstruction', 'unknown', 'traffic_obstruction'], $this->actor);
    $again = $service->route($this->report->refresh(), ['traffic_obstruction'], $this->actor);

    expect($created)->toHaveCount(1)
        ->and($again)->toBe([]);

    $assignment = $created[0]->fresh();
    expect($assignment->department_id)->toBe($this->secondaryDepartment->id)
        ->and($assignment->is_primary)->toBeFalse()
        ->and($assignment->kind)->toBe(ReportAssignment::KIND_SECONDARY)
        ->and($assignment->task_status)->toBe(ReportAssignment::TASK_STATUS_OPEN)
        ->and($assignment->sla_minutes)->toBe(480)
        ->and($this->report->fresh()->department_id)->toBe($this->primaryDepartment->id);

    expect(AuditLog::query()->where('action', 'report.secondary_assigned')->count())->toBe(1);
    expect(AuditLog::query()->where('action', 'report.secondary_assigned')->first()?->after)
        ->toMatchArray([
            'assignment_id' => $assignment->id,
            'primary_assignment_id' => $this->primaryAssignment->id,
            'kind' => ReportAssignment::KIND_SECONDARY,
            'task_status' => ReportAssignment::TASK_STATUS_OPEN,
            'sla_minutes' => 480,
            'trigger' => 'traffic_obstruction',
        ]);

    Event::assertDispatched(ReportAssigned::class, function (ReportAssigned $event) use ($assignment): bool {
        return $event->departmentId === $this->secondaryDepartment->id
            && $event->slaMinutes === 480
            && $event->metadata['assignment_id'] === $assignment->id
            && $event->metadata['kind'] === ReportAssignment::KIND_SECONDARY
            && $event->metadata['task_status'] === ReportAssignment::TASK_STATUS_OPEN;
    });
});

it('does not create a secondary task without a matching open primary', function (): void {
    AppConfig::query()->create([
        'key' => SecondaryRoutingService::APP_CONFIG_KEY,
        'value' => ['traffic_obstruction' => $this->secondaryDepartment->code],
        'enabled' => true,
        'rollout_percentage' => 100,
        'cohort' => null,
    ]);
    $this->primaryAssignment->update(['task_status' => ReportAssignment::TASK_STATUS_COMPLETED, 'completed_at' => now()]);

    expect(app(SecondaryRoutingService::class)->route($this->report->refresh(), ['traffic_obstruction']))->toBe([])
        ->and(ReportAssignment::query()->where('kind', ReportAssignment::KIND_SECONDARY)->count())->toBe(0);
});

it('does not create a secondary task when the configured target is the primary department', function (): void {
    AppConfig::query()->create([
        'key' => SecondaryRoutingService::APP_CONFIG_KEY,
        'value' => ['traffic_obstruction' => $this->primaryDepartment->code],
        'enabled' => true,
        'rollout_percentage' => 100,
        'cohort' => null,
    ]);

    expect(app(SecondaryRoutingService::class)->route($this->report, ['traffic_obstruction']))->toBe([])
        ->and(ReportAssignment::query()->where('kind', ReportAssignment::KIND_SECONDARY)->count())->toBe(0);
});

it('wires AI completion to primary routing followed by secondary routing', function (): void {
    $this->primaryAssignment->delete();
    $this->report->department_id = null;
    $this->report->save();

    AppConfig::query()->create([
        'key' => SecondaryRoutingService::APP_CONFIG_KEY,
        'value' => ['traffic_obstruction' => $this->secondaryDepartment->code],
        'enabled' => true,
        'rollout_percentage' => 100,
        'cohort' => null,
    ]);
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    RoutingRule::factory()->create([
        'name' => 'Test primary routing',
        'conditions' => [],
        'destination_department_id' => $this->primaryDepartment->id,
        'default_priority_id' => $priority->id,
        'default_sla_minutes' => 1440,
        'active' => true,
    ]);

    AiCompleted::dispatch(
        reportId: $this->report->id,
        aiLabel: 'pothole',
        visionResult: [
            'confidence' => 0.97,
            'secondary_triggers' => ['traffic_obstruction'],
        ],
    );

    expect(ReportAssignment::query()->where('report_id', $this->report->id)->count())->toBe(2)
        ->and(ReportAssignment::query()
            ->where('report_id', $this->report->id)
            ->where('kind', ReportAssignment::KIND_SECONDARY)
            ->where('department_id', $this->secondaryDepartment->id)
            ->exists())->toBeTrue();
});
