<?php

declare(strict_types=1);

namespace App\Modules\AI\Listeners;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\Reports\Models\Report;
use App\Modules\Routing\Services\AssignmentService;
use App\Modules\Routing\Services\RoutingEngine;
use App\Modules\Routing\Services\RoutingFallbackService;
use App\Modules\Shared\Services\SystemUserService;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Support\Facades\Log;

/**
 * Wires the M8 AI vision engine output into M7 routing
 * and the M6 workflow engine. Triggered by the
 * `AiCompleted` event.
 *
 *   ai_completed
 *      ├─ routing rule matched   -> AssignmentService::assign
 *      │                            -> WorkflowEngine 'ai_auto_assign'
 *      │                               (ai_processing -> assigned)
 *      ├─ no rule matched + config
 *      │   present                 -> AssignmentService::assign via
 *      │                            RoutingFallbackService
 *      │                            -> WorkflowEngine 'ai_auto_assign'
 *      └─ no rule matched + no
 *          fallback config         -> throws ROUTING_FALLBACK_MISSING
 *                                    (the operator / Super Admin
 *                                    must configure the fallback
 *                                    before the platform can
 *                                    process un-routed reports)
 *
 * The listener is idempotent: it will not re-route a
 * report that already has an active assignment. The
 * "actor" for the workflow transition is the platform's
 * shared system user; the system user carries both
 * `system` and `moderator` Spatie roles so it satisfies
 * the role gates on the `ai_auto_assign` transition
 * (system) and the existing `moderator_review` transition
 * (system).
 */
class AiCompletedListener
{
    public function __construct(
        private readonly RoutingEngine $engine,
        private readonly AssignmentService $assignments,
        private readonly WorkflowEngine $workflow,
        private readonly SystemUserService $system,
        private readonly RoutingFallbackService $fallback,
    ) {}

    public function handle(AiCompleted $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null) {
            Log::warning('AiCompletedListener: report not found', [
                'report_id' => $event->reportId,
            ]);

            return;
        }

        // If the report already has an active assignment
        // (re-runs, retries) skip the routing step. The
        // workflow may have already advanced.
        if ($report->department_id !== null
            && $report->assignments()->whereNull('completed_at')->exists()) {
            return;
        }

        $systemActor = $this->system->user();
        $decision = $this->engine->resolve($report);

        if ($decision === null) {
            // No routing rule matched; fall back to the
            // configured default department (typically a
            // Super Admin moderation queue).
            $decision = $this->fallback->decisionFor($report);
        }

        $this->assignments->assign($report, $decision, $systemActor, reason: 'ai_auto_routing');

        $wfDecision = $this->workflow->evaluate($report, 'ai_auto_assign', $systemActor);

        if ($wfDecision->allowed) {
            $this->workflow->apply($report, $wfDecision, $systemActor);
        }
    }
}
