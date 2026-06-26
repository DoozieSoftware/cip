<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Exceptions\InvalidTransitionException;
use App\Modules\Workflow\Exceptions\UnauthorizedTransitionException;
use App\Modules\Workflow\Models\WorkflowTransition;
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

    // Helper closure (private to this file) for seeding roles.
    $ensureRole = function (string $name): void {
        Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
    };
    $this->ensureRole = $ensureRole;
});

function actorFor(string $role): User
{
    $u = User::factory()->create();
    Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
    $u->assignRole($role);

    return $u;
}

function makeReportAt(string $statusCode, WorkflowRepository $repo): Report
{
    $statusId = (string) ReportStatus::query()->where('code', $statusCode)->value('id');
    $defId = (string) $repo->findActiveByCode('civic_default')->id;

    return Report::factory()->create([
        'workflow_id' => $defId,
        'current_status_id' => $statusId,
    ]);
}

/**
 * Walk every (from_state, event) pair in the seeded
 * default workflow and assert the engine allows the
 * transition. Each case rebuilds a fresh report so a
 * terminal state in step N does not block step N+1.
 */
dataset('everyTransition', function () {
    // Mirrors DefaultWorkflowSeeder::seedTransitions()
    // (the source of truth lives in that seeder; this list
    // is the assertion target, updated in lockstep).
    return [
        'draft submit submitted' => ['from' => 'draft',             'event' => 'submit',            'to' => 'submitted',         'role' => null],
        'submitted ai_complete' => ['from' => 'submitted',         'event' => 'ai_complete',       'to' => 'ai_processing',     'role' => 'system'],
        'ai_processing moderator_review' => ['from' => 'ai_processing',     'event' => 'moderator_review',  'to' => 'pending_moderator', 'role' => 'system'],
        'pending_moderator assign' => ['from' => 'pending_moderator', 'event' => 'assign',            'to' => 'assigned',          'role' => 'moderator'],
        'assigned accept' => ['from' => 'assigned',          'event' => 'accept',            'to' => 'accepted',          'role' => 'department'],
        'accepted start' => ['from' => 'accepted',          'event' => 'start',             'to' => 'in_progress',       'role' => 'department'],
        'in_progress resolve' => ['from' => 'in_progress',       'event' => 'resolve',           'to' => 'resolved',          'role' => 'department'],
        'resolved verify' => ['from' => 'resolved',          'event' => 'verify',            'to' => 'verified',          'role' => 'moderator'],
        'verified close' => ['from' => 'verified',          'event' => 'close',             'to' => 'closed',            'role' => 'moderator'],
        'pending_moderator reject' => ['from' => 'pending_moderator', 'event' => 'reject',            'to' => 'rejected',          'role' => 'moderator'],
        'assigned reject' => ['from' => 'assigned',          'event' => 'reject',            'to' => 'rejected',          'role' => 'department'],
        'accepted reject' => ['from' => 'accepted',          'event' => 'reject',            'to' => 'rejected',          'role' => 'department'],
        'in_progress reject' => ['from' => 'in_progress',       'event' => 'reject',            'to' => 'rejected',          'role' => 'department'],
    ];
});

it('every seeded transition is allowed by the engine', function (string $from, string $event, string $to, ?string $role): void {
    $report = makeReportAt($from, $this->repo);
    $actor = $role === null ? null : actorFor($role);

    $decision = $this->engine->evaluate($report, $event, $actor);
    expect($decision->allowed)->toBeTrue("expected {$from} --{$event}--> {$to} to be allowed");

    $report = $this->engine->apply($report, $decision, $actor);
    $newCode = ReportStatus::query()->find($report->current_status_id)->code;
    expect($newCode)->toBe($to);

    // One status-history row written per transition.
    expect(ReportStatusHistory::query()->where('report_id', $report->id)->count())->toBe(1);
})->with('everyTransition');

it('rejects an event that has no outgoing transition from the current state', function (): void {
    $report = makeReportAt('draft', $this->repo);
    // No 'verify' transition from draft.
    $actor = actorFor('moderator');

    $decision = $this->engine->evaluate($report, 'verify', $actor);
    expect($decision->allowed)->toBeFalse();
});

it('rejects a transition when the actor lacks the required role', function (): void {
    $report = makeReportAt('pending_moderator', $this->repo);
    // 'assign' requires moderator; pass a department user.
    $actor = actorFor('department');

    $decision = $this->engine->evaluate($report, 'assign', $actor);
    expect($decision->allowed)->toBeFalse();
});

it('rejects a transition when no actor is supplied and the transition has a role gate', function (): void {
    $report = makeReportAt('pending_moderator', $this->repo);
    // 'assign' has required_role=moderator.
    $decision = $this->engine->evaluate($report, 'assign', null);
    expect($decision->allowed)->toBeFalse();
});

it('rejects an event on a terminal state', function (): void {
    $report = makeReportAt('closed', $this->repo);
    $actor = actorFor('moderator');

    $decision = $this->engine->evaluate($report, 'close', $actor);
    expect($decision->allowed)->toBeFalse();
});

it('rejects a transition on a report with no workflow', function (): void {
    $statusId = (string) ReportStatus::query()->where('code', 'draft')->value('id');
    $report = Report::factory()->create([
        'workflow_id' => null,
        'current_status_id' => $statusId,
    ]);

    $decision = $this->engine->evaluate($report, 'submit', null);
    expect($decision->allowed)->toBeFalse();
});

it('throws InvalidTransitionException when the guard fails on conditions', function (): void {
    $report = makeReportAt('pending_moderator', $this->repo);

    // Build a transition with a condition the actor cannot satisfy.
    $def = $this->repo->findActiveByCode('civic_default');
    $from = $def->states->firstWhere('code', 'pending_moderator');
    $to = $def->states->firstWhere('code', 'assigned');

    WorkflowTransition::query()->create([
        'workflow_definition_id' => $def->id,
        'from_state_id' => $from->id,
        'to_state_id' => $to->id,
        'event' => 'reassign_with_check',
        'required_role' => 'moderator',
        'required_permission' => null,
        'conditions' => [['eq' => ['moderator.approved', true]]],
        'sla_minutes' => null,
        'notify_before_minutes' => null,
        'priority' => 100,
        'active' => true,
    ]);

    $this->repo->invalidate('civic_default');
    $actor = actorFor('moderator');
    $decision = $this->engine->evaluate($report, 'reassign_with_check', $actor);
    expect($decision->allowed)->toBeFalse();
});

it('throws UnauthorizedTransitionException for a direct guard call without a role', function (): void {
    $t = new WorkflowTransition([
        'required_role' => 'super_admin',
        'required_permission' => null,
        'conditions' => null,
    ]);
    $t->id = 'fake';
    $t->workflow_definition_id = 'fake';
    $t->from_state_id = 'fake';
    $t->to_state_id = 'fake';
    $t->event = 'fake';
    $t->active = true;
    $t->priority = 0;
    $t->sla_minutes = null;
    $t->notify_before_minutes = null;

    $report = makeReportAt('draft', $this->repo);
    $actor = actorFor('moderator');

    $guard = new TransitionGuard(new ConditionEvaluator);

    expect(fn () => $guard->ensure($t, $actor, $report))
        ->toThrow(UnauthorizedTransitionException::class);
});

it('throws InvalidTransitionException for a guard call that fails the condition DSL', function (): void {
    $t = new WorkflowTransition([
        'required_role' => null,
        'required_permission' => null,
        'conditions' => ['report.priority_id' => 'emergency'],
    ]);
    $t->id = 'fake';
    $t->workflow_definition_id = 'fake';
    $t->from_state_id = 'fake';
    $t->to_state_id = 'fake';
    $t->event = 'fake';
    $t->active = true;
    $t->priority = 0;
    $t->sla_minutes = null;
    $t->notify_before_minutes = null;

    $report = makeReportAt('draft', $this->repo);
    $actor = actorFor('moderator');

    $guard = new TransitionGuard(new ConditionEvaluator);

    expect(fn () => $guard->ensure($t, $actor, $report))
        ->toThrow(InvalidTransitionException::class);
});

it('returns INVALID_STATUS code on denials so the API layer can map it', function (): void {
    $report = makeReportAt('closed', $this->repo);
    $actor = actorFor('moderator');

    $decision = $this->engine->evaluate($report, 'close', $actor);
    expect($decision->allowed)->toBeFalse();

    // The first reason should mention the closed state.
    expect($decision->reasons[0])->toContain('closed');
});
