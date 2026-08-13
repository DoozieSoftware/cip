<?php

declare(strict_types=1);

use App\Modules\Departments\Services\DepartmentReportService;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Services\ConditionEvaluator;
use App\Modules\Workflow\Services\TransitionGuard;
use App\Modules\Workflow\Services\WorkflowEngine;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();

    Role::firstOrCreate(['name' => 'department_officer', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'moderator', 'guard_name' => 'web']);

    $this->engine = new WorkflowEngine(new TransitionGuard(new ConditionEvaluator));
    $this->service = new DepartmentReportService($this->engine);
});

function citizenActionReportAt(string $code): Report
{
    $status = ReportStatus::query()->where('code', $code)->firstOrFail();

    return Report::factory()->create(['current_status_id' => $status->id]);
}

it('department resolve moves the report into resolved_pending_verification and opens the deadline', function (): void {
    $report = citizenActionReportAt('in_progress');
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');

    $this->service->resolve($report->refresh(), $officer, null);

    $report->refresh();
    $status = ReportStatus::query()->find($report->current_status_id);
    expect($status->code)->toBe('resolved_pending_verification')
        ->and($report->resolved_at)->not->toBeNull()
        ->and($report->verification_deadline_at)->not->toBeNull();

    // 72-hour verification window.
    expect($report->verification_deadline_at->diffInHours($report->resolved_at))->toBe(72);
});

it('citizen verify moves the report to verified', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $report = citizenActionReportAt('resolved_pending_verification');
    $report->citizen_id = $citizen->id;
    $report->is_anonymous = false;
    $report->save();

    $response = $this->postJson("/api/v1/citizen/reports/{$report->id}/verify", []);

    $response->assertStatus(200);
    $status = ReportStatus::query()->find($report->refresh()->current_status_id);
    expect($status->code)->toBe('verified');
});

it('citizen dispute reopens the report and requires a reason', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $report = citizenActionReportAt('resolved_pending_verification');
    $report->citizen_id = $citizen->id;
    $report->is_anonymous = false;
    $report->verification_deadline_at = now()->addHours(24);
    $report->save();

    // Missing reason -> 422.
    $this->postJson("/api/v1/citizen/reports/{$report->id}/dispute", [])
        ->assertStatus(422);

    // With a reason -> reopened.
    $response = $this->postJson("/api/v1/citizen/reports/{$report->id}/dispute", [
        'reason' => 'The issue is still not fixed.',
    ]);

    $response->assertStatus(200);
    $status = ReportStatus::query()->find($report->refresh()->current_status_id);
    expect($status->code)->toBe('reopened');
});

it('dispute is blocked once the verification deadline has passed', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $report = citizenActionReportAt('resolved_pending_verification');
    $report->citizen_id = $citizen->id;
    $report->is_anonymous = false;
    $report->verification_deadline_at = now()->subHour(); // expired
    $report->save();

    $this->postJson("/api/v1/citizen/reports/{$report->id}/dispute", [
        'reason' => 'Still broken.',
    ])->assertStatus(422);
});

it('a citizen cannot verify or dispute a report they do not own', function (): void {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    Sanctum::actingAs($intruder);

    $report = citizenActionReportAt('resolved_pending_verification');
    $report->citizen_id = $owner->id;
    $report->is_anonymous = false;
    $report->save();

    $this->postJson("/api/v1/citizen/reports/{$report->id}/verify", [])->assertStatus(403);
    $this->postJson("/api/v1/citizen/reports/{$report->id}/dispute", ['reason' => 'x'])->assertStatus(403);
});

it('an anonymous report cannot be verified or disputed', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $report = citizenActionReportAt('resolved_pending_verification');
    $report->citizen_id = $citizen->id;
    $report->is_anonymous = true;
    $report->save();

    $this->postJson("/api/v1/citizen/reports/{$report->id}/verify", [])->assertStatus(403);
});

it('a non-owner citizen (but moderator) still cannot take citizen action via the citizen endpoint', function (): void {
    // Ownership, not role, gates the citizen action. A moderator acting
    // as themselves does not own the report and must use the staff path.
    $citizen = User::factory()->create();
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = citizenActionReportAt('resolved_pending_verification');
    $report->citizen_id = $citizen->id;
    $report->is_anonymous = false;
    $report->save();

    $this->postJson("/api/v1/citizen/reports/{$report->id}/verify", [])->assertStatus(403);
});
