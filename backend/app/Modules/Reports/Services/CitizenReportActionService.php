<?php

declare(strict_types=1);

namespace App\Modules\Reports\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportMergeDispute;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Support\Facades\DB;

/**
 * P1-06 — citizen verification and dispute actions.
 *
 * Citizens can verify a resolution (moving the report to the
 * terminal `verified` state) or dispute it (moving it back to
 * `reopened` for the department to re-work). The dispute action
 * is time-bound: it is only available while the report is in
 * `resolved_pending_verification` and the verification deadline
 * has not passed.
 *
 * P1-07 — citizens can also dispute an incorrect merge. This
 * records a `ReportMergeDispute` row and moves the report out
 * of the terminal `merged` state back to `pending_moderator`
 * for re-review.
 */
class CitizenReportActionService
{
    public function __construct(
        private readonly WorkflowEngine $engine,
    ) {}

    public function verify(Report $report, User $citizen, ?int $expectedWorkflowVersion = null): Report
    {
        return $this->transition($report, $citizen, 'verify', $expectedWorkflowVersion);
    }

    public function dispute(
        Report $report,
        User $citizen,
        string $reason,
        ?int $expectedWorkflowVersion = null,
    ): Report {
        if ($report->verification_deadline_at !== null
            && now()->greaterThan($report->verification_deadline_at)) {
            throw ApiException::validation(
                'The verification window has closed.',
                ['deadline' => ['Verification deadline has passed.']],
            );
        }

        $updated = $this->transition($report, $citizen, 'dispute', $expectedWorkflowVersion);

        AuditLog::query()->create([
            'user_id' => $citizen->id,
            'entity' => 'reports',
            'entity_id' => $report->id,
            'action' => 'report.citizen_dispute',
            'before' => null,
            'after' => ['reason' => $reason],
            'ip' => request()->ip(),
            'device_fingerprint' => null,
            'request_id' => is_string(request()->attributes->get('trace_id')) ? request()->attributes->get('trace_id') : null,
            'created_at' => now(),
        ]);

        return $updated;
    }

    /**
     * P1-07 — dispute an incorrect merge. Records the dispute and
     * transitions the report out of `merged` back to `pending_moderator`.
     */
    public function disputeMerge(
        Report $report,
        User $citizen,
        string $reason,
        ?int $expectedWorkflowVersion = null,
    ): Report {
        $mergedStatus = ReportStatus::query()->where('code', 'merged')->first();

        if ($mergedStatus === null || $report->current_status_id !== $mergedStatus->id) {
            throw ApiException::validation(
                'This report is not currently merged.',
                ['status' => ['Only merged reports can be disputed.']],
            );
        }

        return DB::transaction(function () use ($report, $citizen, $reason, $expectedWorkflowVersion): Report {
            ReportMergeDispute::query()->create([
                'report_id' => $report->id,
                'citizen_id' => $citizen->id,
                'reason' => $reason,
                'status' => 'open',
            ]);

            $pendingModerator = ReportStatus::query()->where('code', 'pending_moderator')->first();

            if ($pendingModerator === null) {
                throw ApiException::validation(
                    'Target status "pending_moderator" not found.',
                    ['status' => ['Workflow misconfiguration.']],
                );
            }

            $decision = $this->engine->evaluate($report, 'dispute_merge', $citizen);

            if (! $decision->allowed) {
                throw ApiException::validation(
                    'This action is not allowed in the current state.',
                    ['event' => $decision->reasons],
                );
            }

            $updated = $this->engine->apply(
                $report,
                $decision,
                $citizen,
                expectedWorkflowVersion: $expectedWorkflowVersion,
            );

            AuditLog::query()->create([
                'user_id' => $citizen->id,
                'entity' => 'reports',
                'entity_id' => $report->id,
                'action' => 'report.citizen_dispute_merge',
                'before' => [
                    'current_status_id' => $report->current_status_id,
                    'merged_into' => $report->merged_into,
                ],
                'after' => [
                    'current_status_id' => $updated->current_status_id,
                    'merged_into' => null,
                ],
                'ip' => request()->ip(),
                'device_fingerprint' => null,
                'request_id' => is_string(request()->attributes->get('trace_id')) ? request()->attributes->get('trace_id') : null,
                'created_at' => now(),
            ]);

            $updated->merged_into = null;
            $updated->merged_at = null;
            $updated->save();

            return $updated;
        });
    }

    private function transition(
        Report $report,
        User $citizen,
        string $event,
        ?int $expectedWorkflowVersion = null,
    ): Report {
        $decision = $this->engine->evaluate($report, $event, $citizen);

        if (! $decision->allowed) {
            throw ApiException::validation(
                'This action is not allowed in the current state.',
                ['event' => $decision->reasons],
            );
        }

        return DB::transaction(function () use ($report, $decision, $citizen, $expectedWorkflowVersion): Report {
            $updated = $this->engine->apply(
                $report,
                $decision,
                $citizen,
                expectedWorkflowVersion: $expectedWorkflowVersion,
            );

            AuditLog::query()->create([
                'user_id' => $citizen->id,
                'entity' => 'reports',
                'entity_id' => $report->id,
                'action' => 'report.citizen_'.$decision->matchedTransitionId,
                'before' => ['current_status_id' => $report->current_status_id],
                'after' => ['current_status_id' => $updated->current_status_id],
                'ip' => request()->ip(),
                'device_fingerprint' => null,
                'request_id' => is_string(request()->attributes->get('trace_id')) ? request()->attributes->get('trace_id') : null,
                'created_at' => now(),
            ]);

            return $updated;
        });
    }
}
