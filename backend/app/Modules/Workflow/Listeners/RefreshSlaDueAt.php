<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Listeners;

use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;

/**
 * Keeps the indexed report SLA deadline aligned with the state entered by a
 * workflow transition. The breach job can then select only due, open rows.
 */
class RefreshSlaDueAt
{
    public function handle(ReportStatusChanged $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null || $report->workflow_id === null) {
            return;
        }

        $statusCode = ReportStatus::query()->whereKey($event->toStatusId)->value('code');

        if (! is_string($statusCode) || $statusCode === '') {
            return;
        }

        $stateId = WorkflowState::query()
            ->where('workflow_definition_id', $report->workflow_id)
            ->where('code', $statusCode)
            ->value('id');

        if (! is_string($stateId) || $stateId === '') {
            return;
        }

        $slaMinutes = WorkflowTransition::query()
            ->where('workflow_definition_id', $report->workflow_id)
            ->where('from_state_id', $stateId)
            ->where('active', true)
            ->whereNotNull('sla_minutes')
            ->min('sla_minutes');

        $report->sla_due_at = is_numeric($slaMinutes)
            ? now()->addMinutes((int) $slaMinutes)
            : null;
        $report->saveQuietly();
    }
}
