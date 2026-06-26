<?php

declare(strict_types=1);

use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use App\Modules\Workflow\Services\ConditionEvaluator;
use App\Modules\Workflow\Services\TransitionGuard;
use App\Modules\Workflow\Services\WorkflowEngine;
use App\Modules\Workflow\ValueObjects\WorkflowDecision;
use Illuminate\Support\Facades\Event;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->engine = new WorkflowEngine(new TransitionGuard(new ConditionEvaluator));

    $this->def = WorkflowDefinition::factory()->create();
    $this->draft = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'draft', 'name' => 'Draft', 'is_initial' => true,
    ]);
    $this->submitted = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'submitted', 'name' => 'Submitted',
    ]);

    foreach (['draft', 'submitted'] as $code) {
        ReportStatus::query()->firstOrCreate(
            ['code' => $code],
            ['name' => ucfirst($code), 'is_terminal' => false, 'sort_order' => 0, 'active' => true],
        );
    }
    $draftStatus = ReportStatus::query()->where('code', 'draft')->first();

    $this->report = Report::factory()->create([
        'workflow_id' => $this->def->id,
        'current_status_id' => $draftStatus->id,
        'citizen_id' => null,
    ]);

    $this->trans = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->draft->id,
        'to_state_id' => $this->submitted->id,
        'event' => 'submit',
        'priority' => 10,
    ]);

    $this->moderator = User::factory()->create();
    Role::firstOrCreate(['name' => 'moderator', 'guard_name' => 'web']);
    $this->moderator->assignRole('moderator');
});

it('updates the report current_status_id and writes a status-history row', function (): void {
    $decision = $this->engine->evaluate($this->report, 'submit', $this->moderator);
    expect($decision->allowed)->toBeTrue();

    $updated = $this->engine->apply($this->report, $decision, $this->moderator);

    $submittedStatus = ReportStatus::query()->where('code', 'submitted')->first();
    expect($updated->current_status_id)->toBe($submittedStatus->id);
    expect(ReportStatusHistory::query()->where('report_id', $this->report->id)->count())->toBe(1);
});

it('dispatches the ReportStatusChanged event with the same metadata', function (): void {
    Event::fake([ReportStatusChanged::class]);

    $decision = $this->engine->evaluate($this->report, 'submit', $this->moderator);
    $this->engine->apply($this->report, $decision, $this->moderator);

    Event::assertDispatched(ReportStatusChanged::class, function (ReportStatusChanged $e): bool {
        return $e->reportId === $this->report->id
            && $e->reason === 'workflow.transition:'.$this->trans->id
            && ($e->metadata['transition_id'] ?? null) === $this->trans->id;
    });
});

it('rejects a negative decision with InvalidArgumentException', function (): void {
    $denial = WorkflowDecision::deny(['nope']);
    $this->engine->apply($this->report, $denial, $this->moderator);
})->throws(InvalidArgumentException::class);

it('is transactional — a failure inside apply does not leak partial state', function (): void {
    // Build a decision that targets a non-existent state id.
    $bad = WorkflowDecision::allow(
        toStateId: '00000000-0000-7000-8000-000000000000',
        matchedTransitionId: $this->trans->id,
    );
    $this->engine->apply($this->report, $bad, $this->moderator);
})->throws(InvalidArgumentException::class);

it('does not write any status-history row when the apply throws', function (): void {
    $bad = WorkflowDecision::allow(
        toStateId: '00000000-0000-7000-8000-000000000000',
        matchedTransitionId: $this->trans->id,
    );

    try {
        $this->engine->apply($this->report, $bad, $this->moderator);
    } catch (Throwable) {
        // expected
    }
    expect(ReportStatusHistory::query()->where('report_id', $this->report->id)->count())->toBe(0);
});
