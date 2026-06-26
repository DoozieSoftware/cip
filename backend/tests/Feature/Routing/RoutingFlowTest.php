<?php

declare(strict_types=1);

use App\Modules\AI\Events\AiCompleted;
use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Services\RoutingFallbackService;
use App\Modules\Settings\Models\AppConfig;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Event::fake([ReportAssigned::class, ReportStatusChanged::class]);
    Cache::flush();
    Log::spy();

    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new RolesAndPermissionsSeeder)->run();
    (new DefaultWorkflowSeeder)->run();

    $this->dept = Department::factory()->create([
        'name' => 'BBMP Ward 112',
    ]);
    $this->priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $this->type = ReportType::factory()->create();
    $this->citizen = User::factory()->create();

    $workflow = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $this->report = Report::factory()->create([
        'citizen_id' => $this->citizen->id,
        'report_type_id' => $this->type->id,
        'current_status_id' => ReportStatus::query()->where('code', 'ai_processing')->firstOrFail()->id,
        'department_id' => null,
        'priority_id' => $this->priority->id,
        'ai_label' => 'pothole',
        'workflow_id' => $workflow->id,
    ]);
});

it('routes and assigns a report when a matching rule is found', function (): void {
    $rule = RoutingRule::factory()->create([
        'name' => 'Pothole -> BBMP Ward 112',
        'priority' => 10,
        'conditions' => ['category_in' => [$this->type->code]],
        'destination_department_id' => $this->dept->id,
        'default_officer_id' => null,
        'default_priority_id' => $this->priority->id,
        'default_sla_minutes' => 240,
        'active' => true,
    ]);

    AiCompleted::dispatch(
        reportId: $this->report->id,
        categoryCode: null,
        severityCode: 'medium',
        aiLabel: 'pothole',
    );

    $fresh = $this->report->fresh();
    expect($fresh->department_id)->toBe($this->dept->id)
        ->and($fresh->priority_id)->toBe($this->priority->id);

    expect(ReportAssignment::query()->where('report_id', $this->report->id)->count())->toBe(1);

    $status = ReportStatus::query()->find($fresh->current_status_id);
    expect($status?->code)->toBe('assigned');

    Event::assertDispatched(ReportAssigned::class, fn (ReportAssigned $e): bool => $e->reportId === $this->report->id
        && $e->departmentId === $this->dept->id
        && $e->slaMinutes === 240);

    Event::assertDispatched(ReportStatusChanged::class, fn (ReportStatusChanged $e): bool => $e->toStatusId === $status?->id);
});

it('falls back to the configured default department when no rule matches', function (): void {
    AppConfig::query()->create([
        'key' => RoutingFallbackService::APP_CONFIG_KEY,
        'value' => ['department_id' => $this->dept->id],
        'enabled' => true,
        'rollout_percentage' => 100,
        'cohort' => null,
        'description' => 'Routing fallback for tests',
    ]);

    // No routing rules at all -> no decision -> fallback.
    AiCompleted::dispatch(
        reportId: $this->report->id,
        aiLabel: 'unknown',
    );

    $fresh = $this->report->fresh();
    expect(ReportAssignment::query()->where('report_id', $this->report->id)->count())->toBe(1);
    expect($fresh->department_id)->toBe($this->dept->id);

    $status = ReportStatus::query()->find($fresh->current_status_id);
    expect($status?->code)->toBe('assigned');

    Event::assertDispatched(ReportAssigned::class, fn (ReportAssigned $e): bool => $e->departmentId === $this->dept->id);
});

it('throws ROUTING_FALLBACK_MISSING when no rule matches and the fallback is not configured', function (): void {
    // The AppConfig row is intentionally absent.

    try {
        AiCompleted::dispatch(
            reportId: $this->report->id,
            aiLabel: 'unknown',
        );
        $this->fail('Expected ROUTING_FALLBACK_MISSING exception.');
    } catch (ApiException $e) {
        expect($e->errorCode)->toBe('ROUTING_FALLBACK_MISSING')
            ->and($e->httpStatus)->toBe(503);
    }

    // No assignment row, no status change.
    expect(ReportAssignment::query()->where('report_id', $this->report->id)->count())->toBe(0);
    $fresh = $this->report->fresh();
    $status = ReportStatus::query()->find($fresh->current_status_id);
    expect($status?->code)->toBe('ai_processing');
});

it('is idempotent: re-dispatching AiCompleted does not create a second assignment', function (): void {
    RoutingRule::factory()->create([
        'name' => 'Catch-all',
        'priority' => 100,
        'conditions' => [],
        'destination_department_id' => $this->dept->id,
        'default_officer_id' => null,
        'default_priority_id' => $this->priority->id,
        'default_sla_minutes' => 60,
        'active' => true,
    ]);

    AiCompleted::dispatch(reportId: $this->report->id, aiLabel: 'pothole');
    expect(ReportAssignment::query()->where('report_id', $this->report->id)->count())->toBe(1);

    // Re-fire the same event. The listener sees the report
    // already has an active assignment and skips.
    AiCompleted::dispatch(reportId: $this->report->id, aiLabel: 'pothole');

    expect(ReportAssignment::query()->where('report_id', $this->report->id)->count())->toBe(1);
});

it('no-ops gracefully when the report id does not exist', function (): void {
    AiCompleted::dispatch(reportId: (string) Str::uuid(), aiLabel: 'pothole');

    Log::shouldHaveReceived('warning')->once();
    Event::assertNotDispatched(ReportAssigned::class);
    Event::assertNotDispatched(ReportStatusChanged::class);
});
