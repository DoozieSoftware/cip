<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Exceptions\UnauthorizedTransitionException;
use App\Modules\Workflow\Repositories\WorkflowRepository;
use App\Modules\Workflow\Services\ConditionEvaluator;
use App\Modules\Workflow\Services\TransitionGuard;
use App\Modules\Workflow\Services\WorkflowEngine;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndPermissionsSeeder::class);
    $this->seed(ReportStatusesSeeder::class);
    $this->seed(DefaultWorkflowSeeder::class);

    $this->engine = new WorkflowEngine(new TransitionGuard(new ConditionEvaluator));
    $this->repo = new WorkflowRepository;
});

function userWithRole(string $role): User
{
    Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
    $u = User::factory()->create();
    $u->assignRole($role);

    return $u;
}

function makeRoleEnforcementReportAt(string $statusCode, WorkflowRepository $repo): Report
{
    $statusId = (string) ReportStatus::query()->where('code', $statusCode)->value('id');
    $defId = (string) $repo->findActiveByCode('civic_default')->id;

    return Report::factory()->create([
        'workflow_id' => $defId,
        'current_status_id' => $statusId,
    ]);
}

it('a citizen cannot trigger the assign event from pending_moderator', function (): void {
    $report = makeRoleEnforcementReportAt('pending_moderator', $this->repo);
    $citizen = userWithRole('citizen');

    $decision = $this->engine->evaluate($report, 'assign', $citizen);
    expect($decision->allowed)->toBeFalse();
    expect($decision->reasons[0])->toContain('role');
});

it('a citizen cannot trigger the verify event from resolved', function (): void {
    $report = makeRoleEnforcementReportAt('resolved', $this->repo);
    $citizen = userWithRole('citizen');

    $decision = $this->engine->evaluate($report, 'verify', $citizen);
    expect($decision->allowed)->toBeFalse();
});

it('a citizen cannot trigger the close event from verified', function (): void {
    $report = makeRoleEnforcementReportAt('verified', $this->repo);
    $citizen = userWithRole('citizen');

    $decision = $this->engine->evaluate($report, 'close', $citizen);
    expect($decision->allowed)->toBeFalse();
});

it('a citizen cannot trigger the accept event from assigned', function (): void {
    $report = makeRoleEnforcementReportAt('assigned', $this->repo);
    $citizen = userWithRole('citizen');

    $decision = $this->engine->evaluate($report, 'accept', $citizen);
    expect($decision->allowed)->toBeFalse();
});

it('a department officer cannot trigger the moderator-only assign event', function (): void {
    $report = makeRoleEnforcementReportAt('pending_moderator', $this->repo);
    $dept = userWithRole('department');

    $decision = $this->engine->evaluate($report, 'assign', $dept);
    expect($decision->allowed)->toBeFalse();
});

it('a department officer cannot trigger the moderator-only verify event', function (): void {
    $report = makeRoleEnforcementReportAt('resolved', $this->repo);
    $dept = userWithRole('department');

    $decision = $this->engine->evaluate($report, 'verify', $dept);
    expect($decision->allowed)->toBeFalse();
});

it('a department officer cannot trigger the moderator-only close event', function (): void {
    $report = makeRoleEnforcementReportAt('verified', $this->repo);
    $dept = userWithRole('department');

    $decision = $this->engine->evaluate($report, 'close', $dept);
    expect($decision->allowed)->toBeFalse();
});

it('a moderator cannot trigger the department-only accept event', function (): void {
    $report = makeRoleEnforcementReportAt('assigned', $this->repo);
    $mod = userWithRole('moderator');

    $decision = $this->engine->evaluate($report, 'accept', $mod);
    expect($decision->allowed)->toBeFalse();
});

it('a moderator cannot trigger the department-only start event', function (): void {
    $report = makeRoleEnforcementReportAt('accepted', $this->repo);
    $mod = userWithRole('moderator');

    $decision = $this->engine->evaluate($report, 'start', $mod);
    expect($decision->allowed)->toBeFalse();
});

it('a moderator cannot trigger the department-only resolve event', function (): void {
    $report = makeRoleEnforcementReportAt('in_progress', $this->repo);
    $mod = userWithRole('moderator');

    $decision = $this->engine->evaluate($report, 'resolve', $mod);
    expect($decision->allowed)->toBeFalse();
});

it('a super_admin can trigger any event the system supports', function (): void {
    // super_admin has the moderator + department permissions
    // transitively via the role hierarchy in RolesAndPermissionsSeeder.
    // The 'assign' event requires `moderator`. The 'accept' event
    // requires `department`. We seed the super_admin user with
    // both roles to simulate the production role-hierarchy.
    $admin = userWithRole('super_admin');
    Role::firstOrCreate(['name' => 'moderator', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
    $admin->assignRole('moderator');
    $admin->assignRole('department');

    $reportAssign = makeRoleEnforcementReportAt('pending_moderator', $this->repo);
    $d1 = $this->engine->evaluate($reportAssign, 'assign', $admin);
    expect($d1->allowed)->toBeTrue();

    $reportAccept = makeRoleEnforcementReportAt('assigned', $this->repo);
    $d2 = $this->engine->evaluate($reportAccept, 'accept', $admin);
    expect($d2->allowed)->toBeTrue();
});

it('a moderator can trigger assign, verify, and close (their own events)', function (): void {
    $mod = userWithRole('moderator');

    $r1 = makeRoleEnforcementReportAt('pending_moderator', $this->repo);
    expect($this->engine->evaluate($r1, 'assign', $mod)->allowed)->toBeTrue();

    $r2 = makeRoleEnforcementReportAt('resolved', $this->repo);
    expect($this->engine->evaluate($r2, 'verify', $mod)->allowed)->toBeTrue();

    $r3 = makeRoleEnforcementReportAt('verified', $this->repo);
    expect($this->engine->evaluate($r3, 'close', $mod)->allowed)->toBeTrue();
});

it('a department officer can trigger accept, start, and resolve (their own events)', function (): void {
    $dept = userWithRole('department');

    $r1 = makeRoleEnforcementReportAt('assigned', $this->repo);
    expect($this->engine->evaluate($r1, 'accept', $dept)->allowed)->toBeTrue();

    $r2 = makeRoleEnforcementReportAt('accepted', $this->repo);
    expect($this->engine->evaluate($r2, 'start', $dept)->allowed)->toBeTrue();

    $r3 = makeRoleEnforcementReportAt('in_progress', $this->repo);
    expect($this->engine->evaluate($r3, 'resolve', $dept)->allowed)->toBeTrue();
});

it('a TransitionGuard call without a role throws UnauthorizedTransitionException', function (): void {
    $def = $this->repo->findActiveByCode('civic_default');
    $t = $def->transitions->firstWhere('event', 'assign');

    $report = makeRoleEnforcementReportAt('pending_moderator', $this->repo);
    $citizen = userWithRole('citizen');

    $guard = new TransitionGuard(new ConditionEvaluator);

    expect(fn () => $guard->ensure($t, $citizen, $report))
        ->toThrow(UnauthorizedTransitionException::class);
});

it('UnauthorizedTransitionException is mapped to a 403 in the API layer', function (): void {
    $e = UnauthorizedTransitionException::missingRole('assign', 'citizen');

    expect($e->getCode())->toBe(403)
        ->and($e->getMessage())->toContain('citizen');
});
