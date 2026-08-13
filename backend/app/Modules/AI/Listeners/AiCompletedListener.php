<?php

declare(strict_types=1);

namespace App\Modules\AI\Listeners;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Services\ConfidenceAggregator;
use App\Modules\Reports\Models\Report;
use App\Modules\Routing\Services\AssignmentService;
use App\Modules\Routing\Services\RoutingEngine;
use App\Modules\Routing\Services\RoutingFallbackService;
use App\Modules\Routing\Services\SecondaryRoutingService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Services\SystemUserService;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Wires the M8 AI vision engine output into M7 routing
 * and the M6 workflow engine. Triggered by the
 * `AiCompleted` event.
 *
 *   ai_completed
 *      ├─ confidence below the auto-route threshold
 *      │   (ConfidenceAggregator)   -> WorkflowEngine 'moderator_review'
 *      │                               (ai_processing -> pending_moderator)
 *      │                               NO department assignment — the
 *      │                               AI's `recommended_department` is
 *      │                               already on the ai_results row for
 *      │                               the moderator to see, but only a
 *      │                               human commits it. This is the
 *      │                               "moderator always overrides AI"
 *      │                               guarantee (AGENTS.md).
 *      ├─ confidence above threshold + routing rule matched
 *      │                            -> AssignmentService::assign
 *      │                               -> WorkflowEngine 'ai_auto_assign'
 *      │                                  (ai_processing -> assigned)
 *      ├─ confidence above threshold + no rule matched + config
 *      │   present                 -> AssignmentService::assign via
 *      │                            RoutingFallbackService
 *      │                            -> WorkflowEngine 'ai_auto_assign'
 *      └─ confidence above threshold + no rule matched + no
 *          fallback config         -> throws ROUTING_FALLBACK_MISSING
 *                                    (the operator / Super Admin
 *                                    must configure the fallback
 *                                    before the platform can
 *                                    process un-routed reports)
 *
 * The listener is idempotent: it will not re-route a
 * report that already has an active assignment, and the
 * `moderator_review` transition is a no-op once the report
 * has already left `ai_processing` (WorkflowEngine::evaluate
 * only matches transitions from the report's current state).
 * The "actor" for the workflow transition is the platform's
 * shared system user; the system user carries both
 * `system` and `moderator` Spatie roles so it satisfies
 * the role gates on the `ai_auto_assign` transition
 * (system) and the `moderator_review` transition (system).
 */
class AiCompletedListener
{
    public function __construct(
        private readonly RoutingEngine $engine,
        private readonly AssignmentService $assignments,
        private readonly WorkflowEngine $workflow,
        private readonly SystemUserService $system,
        private readonly RoutingFallbackService $fallback,
        private readonly ConfidenceAggregator $confidence,
        private readonly SecondaryRoutingService $secondary,
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

        // If the report already has an active PRIMARY assignment
        // (re-runs, retries) skip the routing step. The workflow
        // may have already advanced. Secondary (linked) tasks must
        // not block routing.
        if ($report->department_id !== null
            && $report->assignments()->openPrimary()->exists()) {
            return;
        }

        $systemActor = $this->system->user();

        // `confidence` on AiResponse/visionResult is [0.0, 1.0];
        // ConfidenceAggregator's thresholds are on a 0-100 scale.
        $confidenceRaw = $event->visionResult['confidence'] ?? 0.0;
        $confidencePct = is_numeric($confidenceRaw) ? ((float) $confidenceRaw) * 100 : 0.0;

        // Claim-mismatch gate: even when confidence is high enough
        // to auto-route, a claim that doesn't match the evidence
        // must go through a human moderator. The AI may have
        // hallucinated a category that looks plausible but isn't
        // actually visible in the image. The moderator can verify
        // the visual classification before committing it.
        $claimMatches = $event->visionResult['claim_matches_evidence'] ?? true;
        $consistencyRaw = $event->visionResult['consistency_score'] ?? null;
        $lowConsistency = is_numeric($consistencyRaw) && ((int) $consistencyRaw) < 50;
        $hasMismatch = $claimMatches === false || $lowConsistency;

        $autoRoute = $this->confidence->decide($confidencePct) === ConfidenceAggregator::DECISION_AUTO_ROUTE
            && ! $hasMismatch;

        // Phase 1: read the emergency flag and secondary triggers so the
        // assignment reason carries them for Track B's
        // SecondaryRoutingService and the moderator's emergency review.
        // No auto-dispatch in Phase 1 (blocked on governance policy O4).
        $emergencyFlag = $event->visionResult['emergency_flag'] ?? false;
        $emergencyFlag = $emergencyFlag === true || $emergencyFlag === 1 || $emergencyFlag === 'true';

        $rawTriggers = $event->visionResult['secondary_triggers'] ?? [];
        $secondaryTriggers = is_array($rawTriggers)
            ? array_values(array_filter($rawTriggers, 'is_string'))
            : [];
        $secondaryTriggers = array_values(array_intersect($secondaryTriggers, [
            'traffic_obstruction',
            'road_damage_by_utility_work',
            'sewage_in_drain',
            'cable_hazard',
            'footpath_damage_by_parking',
        ]));

        $signalMetadata = [
            'ai_emergency_flag' => $emergencyFlag,
            'ai_secondary_triggers' => $secondaryTriggers,
        ];

        if ($emergencyFlag) {
            Log::warning('AiCompletedListener: emergency flag raised on report', [
                'report_id' => $report->id,
                'category' => $event->visionResult['predicted_type'] ?? 'unknown',
            ]);
        }

        if (! $autoRoute) {
            $reviewDecision = $this->workflow->evaluate($report, 'moderator_review', $systemActor);

            if ($reviewDecision->allowed) {
                $this->workflow->apply($report, $reviewDecision, $systemActor, $signalMetadata);
            }

            return;
        }

        $decision = $this->engine->resolve($report);

        if ($decision === null) {
            // No routing rule matched; fall back to the
            // configured default department (typically a
            // Super Admin moderation queue).
            $decision = $this->fallback->decisionFor($report);
        }

        // Build the assignment reason with Phase 1 signals appended.
        $reason = 'ai_auto_routing';

        if ($emergencyFlag) {
            $reason .= ' [EMERGENCY]';
        }

        if ($secondaryTriggers !== []) {
            $reason .= ' [secondary: '.implode(',', $secondaryTriggers).']';
        }

        DB::transaction(function () use ($report, $decision, $systemActor, $reason, $secondaryTriggers, $signalMetadata): void {
            $this->assignments->assign($report, $decision, $systemActor, reason: $reason);

            // The primary assignment remains the report owner. Secondary rows
            // are linked co-tasks and never update reports.department_id.
            $this->secondary->route($report, $secondaryTriggers, $systemActor, reason: $reason);

            $wfDecision = $this->workflow->evaluate($report, 'ai_auto_assign', $systemActor);

            if (! $wfDecision->allowed) {
                throw new ApiException(
                    'ASSIGNMENT_TRANSITION_CONFLICT',
                    'The assignment could not be committed because its workflow transition is no longer allowed.',
                    409,
                    ['reasons' => $wfDecision->reasons],
                );
            }

            $this->workflow->apply($report, $wfDecision, $systemActor, $signalMetadata);
        });
    }
}
