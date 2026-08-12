<?php

declare(strict_types=1);

/**
 * WF-01 regression tests — canonical lifecycle invariants.
 *
 *  - `verified` must have an incoming executable transition
 *    (reachable from `resolved_pending_verification` via `verify`).
 *  - `escalated` must have a reliable exit (review → pending_moderator,
 *    assign → assigned).
 *  - `resolved` must NOT have a `close` transition that bypasses
 *    citizen verification.
 *  - Citizen verification, reopening, and supervisor escalation must
 *    all be exercisable end-to-end.
 */

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowTransition;
use App\Modules\Workflow\Repositories\WorkflowRepository;
use App\Modules\Workflow\Services\ConditionEvaluator;
use App\Modules\Workflow\Services\TransitionGuard;
use App\Modules\Workflow\Services\WorkflowEngine;
use Database\Seeders\DefaultWorkflowSeeder;
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

it('verified has an incoming executable transition from resolved_pending_verification', function (): void {
    $graph = $this->repo->loadGraph('civic_default');
    $states = $graph['states'];

    $incomingToVerified = collect($graph['transitions'])
        ->contains(fn (WorkflowTransition $t) => $t->to_state_id === $states['verified']->id);

    expect($incomingToVerified)->toBeTrue();
});

it('escalated has a reliable exit back to pending_moderator and to assigned', function (): void {
    $graph = $this->repo->loadGraph('civic_default');
    $states = $graph['states'];

    $exits = collect($graph['transitions'])
        ->where('from_state_id', $states['escalated']->id)
        ->pluck('event')
        ->all();

    expect($exits)->toContain('review');
    expect($exits)->toContain('assign');
});

it('resolved has no close transition that bypasses citizen verification', function (): void {
    $graph = $this->repo->loadGraph('civic_default');
    $states = $graph['states'];

    $resolvedClose = collect($graph['transitions'])
        ->first(fn (WorkflowTransition $t) => $t->from_state_id === $states['resolved']->id
            && $t->event === 'close');

    expect($resolvedClose)->toBeNull();
});

it('citizen can verify a resolved_pending_verification report', function (): void {
    $status = ReportStatus::query()->where('code', 'resolved_pending_verification')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $status->id,
    ]);

    $citizen = makeActor('citizen');
    $d = $this->engine->evaluate($report, 'verify', $citizen);
    expect($d->allowed)->toBeTrue();

    $report = $this->engine->apply($report, $d, $citizen);
    expect(ReportStatus::query()->find($report->current_status_id)->code)->toBe('verified');
});

it('citizen can dispute a resolved_pending_verification report to reopen it', function (): void {
    $status = ReportStatus::query()->where('code', 'resolved_pending_verification')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $status->id,
    ]);

    $citizen = makeActor('citizen');
    $d = $this->engine->evaluate($report, 'dispute', $citizen);
    expect($d->allowed)->toBeTrue();

    $report = $this->engine->apply($report, $d, $citizen);
    expect(ReportStatus::query()->find($report->current_status_id)->code)->toBe('reopened');
});

it('reopened report can be resolved back to resolved_pending_verification', function (): void {
    $status = ReportStatus::query()->where('code', 'reopened')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $status->id,
    ]);

    $department = makeActor('department_officer');
    $d = $this->engine->evaluate($report, 'resolve', $department);
    expect($d->allowed)->toBeTrue();

    $report = $this->engine->apply($report, $d, $department);
    expect(ReportStatus::query()->find($report->current_status_id)->code)->toBe('resolved_pending_verification');
});

it('supervisor can escalate a report then review it back to pending_moderator', function (): void {
    $pending = ReportStatus::query()->where('code', 'pending_moderator')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $pending->id,
    ]);

    $moderator = makeActor('moderator');

    $d1 = $this->engine->evaluate($report, 'escalate', $moderator);
    expect($d1->allowed)->toBeTrue();
    $report = $this->engine->apply($report, $d1, $moderator);
    expect(ReportStatus::query()->find($report->current_status_id)->code)->toBe('escalated');

    $d2 = $this->engine->evaluate($report, 'review', $moderator);
    expect($d2->allowed)->toBeTrue();
    $report = $this->engine->apply($report, $d2, $moderator);
    expect(ReportStatus::query()->find($report->current_status_id)->code)->toBe('pending_moderator');
});

it('supervisor can escalate a report then assign it directly', function (): void {
    $pending = ReportStatus::query()->where('code', 'pending_moderator')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $pending->id,
    ]);

    $moderator = makeActor('moderator');

    $d1 = $this->engine->evaluate($report, 'escalate', $moderator);
    expect($d1->allowed)->toBeTrue();
    $report = $this->engine->apply($report, $d1, $moderator);

    $d2 = $this->engine->evaluate($report, 'assign', $moderator);
    expect($d2->allowed)->toBeTrue();
    $report = $this->engine->apply($report, $d2, $moderator);
    expect(ReportStatus::query()->find($report->current_status_id)->code)->toBe('assigned');
});

it('moderator can override-close a resolved_pending_verification report', function (): void {
    $status = ReportStatus::query()->where('code', 'resolved_pending_verification')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $status->id,
    ]);

    $moderator = makeActor('moderator');
    $d = $this->engine->evaluate($report, 'close', $moderator);
    expect($d->allowed)->toBeTrue();

    $report = $this->engine->apply($report, $d, $moderator);
    expect(ReportStatus::query()->find($report->current_status_id)->code)->toBe('closed');
});

it('moderator can close a verified report', function (): void {
    $status = ReportStatus::query()->where('code', 'verified')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $status->id,
    ]);

    $moderator = makeActor('moderator');
    $d = $this->engine->evaluate($report, 'close', $moderator);
    expect($d->allowed)->toBeTrue();

    $report = $this->engine->apply($report, $d, $moderator);
    expect(ReportStatus::query()->find($report->current_status_id)->code)->toBe('closed');
});

it('citizen can dispute an incorrect merge back to pending_moderator', function (): void {
    $status = ReportStatus::query()->where('code', 'merged')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $status->id,
    ]);

    $citizen = makeActor('citizen');
    $d = $this->engine->evaluate($report, 'dispute_merge', $citizen);
    expect($d->allowed)->toBeTrue();

    $report = $this->engine->apply($report, $d, $citizen);
    expect(ReportStatus::query()->find($report->current_status_id)->code)->toBe('pending_moderator');
});

function makeActor(string $role): User
{
    $u = User::factory()->create();
    Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
    $u->assignRole($role);

    return $u;
}
