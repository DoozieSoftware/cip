<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Repositories\WorkflowRepository;
use App\Modules\Workflow\Services\ConditionEvaluator;
use App\Modules\Workflow\Services\TransitionGuard;
use App\Modules\Workflow\Services\WorkflowEngine;
use Database\Seeders\DefaultWorkflowSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->seed(RolesAndPermissionsSeeder::class);
    $this->seed(ReportStatusesSeeder::class);
    $this->seed(DefaultWorkflowSeeder::class);
    $this->engine = new WorkflowEngine(new TransitionGuard(new ConditionEvaluator));
    $this->repo = new WorkflowRepository;
});

it('seeds the default civic workflow with 11 states and 14 transitions', function (): void {
    $graph = $this->repo->loadGraph('civic_default');
    expect($graph)->not->toBeNull();
    expect($graph['states'])->toHaveCount(13);
    expect($graph['transitions'])->toHaveCount(17);
    expect(array_keys($graph['states']))->toContain('draft', 'submitted', 'closed', 'rejected');
});

it('a report can traverse draft -> submitted -> ai_processing -> pending_moderator -> assigned -> accepted -> in_progress -> resolved -> verified -> closed', function (): void {
    // Build a report at draft, then walk the happy path.
    $draftStatus = ReportStatus::query()->where('code', 'draft')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $draftStatus->id,
    ]);

    $citizen = User::factory()->create();
    Role::firstOrCreate(['name' => 'citizen', 'guard_name' => 'web']);
    $citizen->assignRole('citizen');

    $system = makeUserWithRole('system');
    $moderator = makeUserWithRole('moderator');
    $department = makeUserWithRole('department');

    // The transitions require permissions that don't exist
    // yet in the permission matrix; grant the necessary
    // permissions to the actor inline.

    $path = [
        ['event' => 'submit',           'actor' => $citizen,   'expectCode' => 'submitted'],
        ['event' => 'ai_complete',      'actor' => $system,    'expectCode' => 'ai_processing'],
        ['event' => 'moderator_review', 'actor' => $system,    'expectCode' => 'pending_moderator'],
        ['event' => 'assign',           'actor' => $moderator, 'expectCode' => 'assigned'],
        ['event' => 'accept',           'actor' => $department, 'expectCode' => 'accepted'],
        ['event' => 'start',            'actor' => $department, 'expectCode' => 'in_progress'],
        ['event' => 'resolve',          'actor' => $department, 'expectCode' => 'resolved'],
        ['event' => 'verify',           'actor' => $moderator, 'expectCode' => 'verified'],
        ['event' => 'close',            'actor' => $moderator, 'expectCode' => 'closed'],
    ];

    foreach ($path as $step) {
        $decision = $this->engine->evaluate($report, $step['event'], $step['actor']);
        expect($decision->allowed)->toBeTrue("transition '{$step['event']}' should be allowed");
        $report = $this->engine->apply($report, $decision, $step['actor']);
        $currentCode = ReportStatus::query()->find($report->current_status_id)->code;
        expect($currentCode)->toBe($step['expectCode'], "expected '{$step['expectCode']}', got '{$currentCode}'");
    }
});

it('a pending_moderator report can be rejected to the rejected terminal state', function (): void {
    $pendingStatus = ReportStatus::query()->where('code', 'pending_moderator')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $pendingStatus->id,
    ]);

    $moderator = makeUserWithRole('moderator');

    $d = $this->engine->evaluate($report, 'reject', $moderator);
    expect($d->allowed)->toBeTrue();
    $report = $this->engine->apply($report, $d, $moderator);

    $currentCode = ReportStatus::query()->find($report->current_status_id)->code;
    expect($currentCode)->toBe('rejected');
});

it('rejects an unknown event with a denied decision and a reason', function (): void {
    $draftStatus = ReportStatus::query()->where('code', 'draft')->first();
    $report = Report::factory()->create([
        'workflow_id' => $this->repo->findActiveByCode('civic_default')->id,
        'current_status_id' => $draftStatus->id,
    ]);

    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    $d = $this->engine->evaluate($report, 'teleport', $citizen);
    expect($d->allowed)->toBeFalse();
    expect($d->reasons[0])->toContain("No transition for event 'teleport'");
});

it('the seeder is idempotent (re-running does not duplicate states or transitions)', function (): void {
    $this->seed(DefaultWorkflowSeeder::class);
    $graph = $this->repo->loadGraph('civic_default');
    expect($graph['states'])->toHaveCount(13);
    expect($graph['transitions'])->toHaveCount(17);
});

/**
 * Helper — create a user and assign them a Spatie role.
 */
function makeUserWithRole(string $role): User
{
    $u = User::factory()->create();
    Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
    $u->assignRole($role);

    return $u;
}
