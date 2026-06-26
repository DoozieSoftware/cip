<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
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
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Cache::flush();
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();

    $this->dept = Department::factory()->create();
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
        'workflow_id' => $workflow->id,
    ]);
});

it('throws ROUTING_FALLBACK_MISSING when no app_config is configured', function (): void {
    $service = new RoutingFallbackService;

    expect(fn () => $service->defaultDepartment())->toThrow(
        fn (ApiException $e) => $e->errorCode === 'ROUTING_FALLBACK_MISSING' && $e->httpStatus === 503,
    );
});

it('throws ROUTING_FALLBACK_MISSING when the app_config value is malformed', function (): void {
    AppConfig::query()->create([
        'key' => RoutingFallbackService::APP_CONFIG_KEY,
        'value' => ['oops' => 'no department_id field'],
        'enabled' => true,
        'rollout_percentage' => 100,
        'description' => null,
        'cohort' => null,
    ]);

    $service = new RoutingFallbackService;

    expect(fn () => $service->defaultDepartment())->toThrow(ApiException::class);
});

it('throws ROUTING_FALLBACK_MISSING when the configured department does not exist', function (): void {
    AppConfig::query()->create([
        'key' => RoutingFallbackService::APP_CONFIG_KEY,
        'value' => ['department_id' => (string) Str::uuid()],
        'enabled' => true,
        'rollout_percentage' => 100,
        'description' => null,
        'cohort' => null,
    ]);

    $service = new RoutingFallbackService;

    expect(fn () => $service->defaultDepartment())->toThrow(ApiException::class);
});

it('returns the configured department when the fallback is well-formed', function (): void {
    AppConfig::query()->create([
        'key' => RoutingFallbackService::APP_CONFIG_KEY,
        'value' => ['department_id' => $this->dept->id],
        'enabled' => true,
        'rollout_percentage' => 100,
        'description' => 'test',
        'cohort' => null,
    ]);

    $service = new RoutingFallbackService;
    $resolved = $service->defaultDepartment();

    expect($resolved->id)->toBe($this->dept->id);
});

it('produces a fallback decision whose destination matches the configured department', function (): void {
    AppConfig::query()->create([
        'key' => RoutingFallbackService::APP_CONFIG_KEY,
        'value' => ['department_id' => $this->dept->id],
        'enabled' => true,
        'rollout_percentage' => 100,
        'description' => 'test',
        'cohort' => null,
    ]);

    $service = new RoutingFallbackService;
    $decision = $service->decisionFor($this->report);

    expect($decision->matchedRule)->toBeNull()
        ->and($decision->destinationDepartment->id)->toBe($this->dept->id)
        ->and($decision->defaultOfficer)->toBeNull()
        ->and($decision->defaultPriority->id)->toBe($this->priority->id)
        ->and($decision->defaultSlaMinutes)->toBe(RoutingFallbackService::DEFAULT_SLA_MINUTES);
});

it('returns the report\'s current priority in the fallback decision', function (): void {
    AppConfig::query()->create([
        'key' => RoutingFallbackService::APP_CONFIG_KEY,
        'value' => ['department_id' => $this->dept->id],
        'enabled' => true,
        'rollout_percentage' => 100,
        'description' => 'test',
        'cohort' => null,
    ]);

    $highPriority = ReportPriority::query()->where('code', 'high')->firstOrFail();
    $this->report->priority_id = $highPriority->id;
    $this->report->save();

    $service = new RoutingFallbackService;
    $decision = $service->decisionFor($this->report->refresh());

    expect($decision->defaultPriority->id)->toBe($highPriority->id);
});
