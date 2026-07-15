<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\Reports\Models\InternalNote;
use App\Modules\Reports\Models\Report;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * M11 — Service that drives the department-officer workflow
 * (accept → start → progress → resolve → close) and the
 * internal-note endpoint.
 *
 * Per `docs/05` §9 and `docs/08` §7. Every action:
 *
 *   1. Asks the M6 `WorkflowEngine` whether the transition is
 *      allowed for the current state.
 *   2. If allowed, applies the transition + persists.
 *   3. Writes a row to `audit_logs` with the before/after
 *      status and the actor's id.
 *   4. Dispatches `ReportStatusChanged` for the M9 notification
 *      fan-out.
 *
 * Manual actions use the events: `accept`, `start`, `progress`,
 * `resolve`, `close`. The service is intentionally strict —
 * any disallowed transition returns 422.
 */
class DepartmentReportService
{
    public function __construct(private readonly WorkflowEngine $engine) {}

    public function accept(Report $report, User $actor, ?Request $request): Report
    {
        return $this->run($report, 'accept', $actor, $request, payload: [
            'kind' => 'lifecycle',
            'lifecycle_event' => 'accept',
        ]);
    }

    public function start(Report $report, User $actor, ?Request $request): Report
    {
        return $this->run($report, 'start', $actor, $request, payload: [
            'kind' => 'lifecycle',
            'lifecycle_event' => 'start',
        ]);
    }

    public function progress(Report $report, User $actor, ?Request $request, ?string $note = null): Report
    {
        // Progress is a free-form comment + audit; it does NOT
        // transition the workflow. M11 has no `progress` event
        // — the canonical transitions are accept / start / resolve.
        return DB::transaction(function () use ($report, $actor, $request, $note): Report {
            $requestId = $request?->attributes->get('trace_id');
            AuditLog::query()->create([
                'user_id' => $actor->getKey(),
                'entity' => 'reports',
                'entity_id' => $report->getKey(),
                'action' => 'report.department_progress',
                'before' => null,
                'after' => [
                    'kind' => 'progress_comment',
                    'note' => $note,
                ],
                'ip' => $request?->ip(),
                'device_fingerprint' => null,
                'request_id' => is_string($requestId) ? $requestId : null,
                'created_at' => now(),
            ]);

            return $report->refresh()->load(['status', 'reportType', 'department', 'priority']);
        });
    }

    public function resolve(Report $report, User $actor, ?Request $request, ?string $note = null): Report
    {
        return $this->run($report, 'resolve', $actor, $request, payload: [
            'kind' => 'lifecycle',
            'lifecycle_event' => 'resolve',
            'note' => $note,
        ]);
    }

    public function close(Report $report, User $actor, ?Request $request, ?string $note = null): Report
    {
        return $this->run($report, 'close', $actor, $request, payload: [
            'kind' => 'lifecycle',
            'lifecycle_event' => 'close',
            'note' => $note,
        ]);
    }

    public function addNote(Report $report, User $actor, string $body, ?Request $request): InternalNote
    {
        if (! $report->department_id) {
            throw new ApiException('REPORT_HAS_NO_DEPARTMENT', 'Report has no department; cannot add a department note.', 422);
        }

        if (trim($body) === '') {
            throw new ApiException('EMPTY_NOTE', 'Note body cannot be empty.', 422);
        }

        if (mb_strlen($body) > 4000) {
            throw new ApiException('NOTE_TOO_LONG', 'Note body cannot exceed 4000 characters.', 422);
        }

        return DB::transaction(function () use ($report, $actor, $body, $request): InternalNote {
            $note = InternalNote::query()->create([
                'report_id' => $report->getKey(),
                'department_id' => $report->department_id,
                'author_id' => $actor->getKey(),
                'body' => $body,
                'created_at' => now(),
            ]);

            $requestId = $request?->attributes->get('trace_id');
            AuditLog::query()->create([
                'user_id' => $actor->getKey(),
                'entity' => 'reports',
                'entity_id' => $report->getKey(),
                'action' => 'report.note_added',
                'before' => null,
                'after' => [
                    'department_id' => $report->department_id,
                    'note_id' => $note->getKey(),
                ],
                'ip' => $request?->ip(),
                'device_fingerprint' => null,
                'request_id' => is_string($requestId) ? $requestId : null,
                'created_at' => now(),
            ]);

            return $note->refresh();
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function run(Report $report, string $event, User $actor, ?Request $request, array $payload): Report
    {
        $decision = $this->engine->evaluate($report, $event, $actor);

        if (! $decision->allowed) {
            throw new ApiException(
                'TRANSITION_NOT_ALLOWED',
                'Transition not allowed: '.implode('; ', $decision->reasons),
                422,
                ['event' => $event, 'current_status' => $report->status?->code],
            );
        }

        return DB::transaction(function () use ($report, $event, $actor, $request, $decision, $payload): Report {
            $before = $report->status?->code;
            $updated = $this->engine->apply($report, $decision, $actor);
            $after = $updated->status?->code;

            $requestId = $request?->attributes->get('trace_id');
            AuditLog::query()->create([
                'user_id' => $actor->getKey(),
                'entity' => 'reports',
                'entity_id' => $updated->getKey(),
                'action' => 'report.department_action',
                'before' => ['status' => $before],
                'after' => $payload + [
                    'event' => $event,
                    'status' => $after,
                ],
                'ip' => $request?->ip(),
                'device_fingerprint' => null,
                'request_id' => is_string($requestId) ? $requestId : null,
                'created_at' => now(),
            ]);

            // WorkflowEngine::apply() already dispatches
            // ReportStatusChanged with the correct from/to and the
            // transition id. Do NOT dispatch a second event here —
            // doing so wrote a duplicate history row for every
            // officer action (e.g. "Accepted → Accepted" alongside
            // the real "Assigned → Accepted").

            return $updated->refresh()->load(['status', 'reportType', 'department', 'priority']);
        });
    }
}
