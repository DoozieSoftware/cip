<?php

declare(strict_types=1);

namespace App\Modules\Routing\Services;

use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Routing\ValueObjects\RoutingDecision;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * M7 AssignmentService.
 *
 * Turns a `RoutingDecision` into a `ReportAssignment` row:
 *  - resolves the assigned officer (round-robin within the
 *    department) or falls back to the rule's
 *    `default_officer_id` when no eligible officer exists
 *  - writes a `report_assignments` row inside a DB
 *    transaction
 *  - updates `report.department_id` and `report.priority_id`
 *    on the report itself (per docs/03 sec 16 the
 *    routing step is the one that fills the department
 *    bucket)
 *  - dispatches the immutable `ReportAssigned` event so
 *    downstream consumers (notifications, audit, analytics)
 *    can react
 *
 * Round-robin state is held in the cache so a fresh
 * container instance picks up where the previous one left
 * off. The cache key is `routing:rr:<dept_id>` -> the index
 * of the next officer in the rotation list.
 */
class AssignmentService
{
    public const ROUND_ROBIN_CACHE_PREFIX = 'routing:rr:';

    public function __construct() {}

    public function assign(Report $report, RoutingDecision $decision, ?User $actor, ?string $reason = null): ReportAssignment
    {
        $assignment = DB::transaction(function () use ($report, $decision, $actor): ReportAssignment {
            $department = $decision->destinationDepartment;
            $officer = $decision->defaultOfficer ?? $this->pickOfficer($department->id);

            $assignment = ReportAssignment::query()->create([
                'report_id' => $report->id,
                'department_id' => $department->id,
                'officer_id' => $officer?->id,
                'assigned_by' => $actor?->id,
                'assigned_at' => now(),
                'accepted_at' => null,
                'completed_at' => null,
                'reassignment_reason' => null,
            ]);

            // Mirror the routing decision onto the report
            // itself so list / search queries can filter on
            // the resolved department + priority without a
            // join to `report_assignments`.
            $report->department_id = $department->id;
            $report->priority_id = $decision->defaultPriority->id;
            $report->save();

            return $assignment;
        });

        ReportAssigned::dispatch(
            reportId: $report->id,
            departmentId: $assignment->department_id,
            officerId: $assignment->officer_id,
            slaMinutes: $decision->defaultSlaMinutes,
            actorId: $actor?->id,
            reason: $reason,
        );

        return $assignment;
    }

    /**
     * Round-robin: pick the next officer in the department's
     * staff list, advancing the cursor in the cache.
     */
    public function pickOfficer(string $departmentId): ?User
    {
        $candidates = $this->loadOfficers($departmentId);

        if ($candidates === []) {
            return null;
        }

        $key = self::ROUND_ROBIN_CACHE_PREFIX.$departmentId;
        $index = (int) Cache::get($key, 0);
        $picked = $candidates[$index % count($candidates)];

        Cache::put($key, ($index + 1) % count($candidates), now()->addDay());

        return $picked;
    }

    /**
     * @return list<User>
     */
    private function loadOfficers(string $departmentId): array
    {
        $rows = DB::table('department_users')
            ->where('department_id', $departmentId)
            ->orderBy('user_id')
            ->pluck('user_id');

        if ($rows->isEmpty()) {
            return [];
        }

        return User::query()
            ->whereIn('id', $rows->all())
            ->orderBy('id')
            ->get()
            ->all();
    }
}
