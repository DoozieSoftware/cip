<?php

declare(strict_types=1);

use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use App\Modules\Workflow\Services\ConditionEvaluator;
use App\Modules\Workflow\Services\TransitionGuard;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->engine = new WorkflowEngine(new TransitionGuard(new ConditionEvaluator));
    $this->definition = WorkflowDefinition::factory()->create();
    $this->draftState = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->definition->id,
        'code' => 'draft',
        'name' => 'Draft',
        'is_initial' => true,
    ]);
    $this->submittedState = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->definition->id,
        'code' => 'submitted',
        'name' => 'Submitted',
    ]);

    foreach (['draft', 'submitted'] as $code) {
        ReportStatus::query()->firstOrCreate(
            ['code' => $code],
            ['name' => ucfirst($code), 'is_terminal' => false, 'sort_order' => 0, 'active' => true],
        );
    }

    WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->definition->id,
        'from_state_id' => $this->draftState->id,
        'to_state_id' => $this->submittedState->id,
        'event' => 'submit',
    ]);

    $this->report = Report::factory()->create([
        'workflow_id' => $this->definition->id,
        'current_status_id' => ReportStatus::query()->where('code', 'draft')->firstOrFail()->id,
        'workflow_version' => 1,
    ]);
});

it('increments and exposes the workflow version after a transition', function (): void {
    $decision = $this->engine->evaluate($this->report, 'submit', null);
    $updated = $this->engine->apply($this->report, $decision, null, expectedWorkflowVersion: 1);

    expect($updated->workflow_version)->toBe(2)
        ->and((new ReportResource($updated))->resolve()['workflow_version'])->toBe(2);

    $audit = AuditLog::query()
        ->where('entity_id', $this->report->id)
        ->where('action', 'workflow.transition')
        ->firstOrFail();

    expect($audit->before['workflow_version'])->toBe(1)
        ->and($audit->after['workflow_version'])->toBe(2);
});

it('rejects a same-state lost update when the workflow version is stale', function (): void {
    $decision = $this->engine->evaluate($this->report, 'submit', null);

    DB::table('reports')
        ->where('id', $this->report->id)
        ->update(['workflow_version' => 2]);

    try {
        $this->engine->apply($this->report, $decision, null, expectedWorkflowVersion: 1);
        $this->fail('Expected a report version conflict.');
    } catch (ApiException $exception) {
        expect($exception->errorCode)->toBe('REPORT_VERSION_CONFLICT')
            ->and($exception->httpStatus)->toBe(409)
            ->and($exception->details)->toMatchArray([
                'expected_workflow_version' => 1,
                'actual_workflow_version' => 2,
            ]);
    }

    $fresh = $this->report->fresh();
    expect($fresh->current_status_id)->toBe($this->report->current_status_id)
        ->and($fresh->workflow_version)->toBe(2)
        ->and(AuditLog::query()->where('entity_id', $this->report->id)->count())->toBe(0);
});
