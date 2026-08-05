<?php

declare(strict_types=1);

namespace App\Modules\Routing\Services;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Settings\Models\AppConfig;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates linked department tasks from the approved AI trigger signals.
 *
 * The mapping is stored in the existing `app_configs` JSON payload under
 * {@see APP_CONFIG_KEY}; values are department codes, so administrators can
 * change a destination without changing application code. A secondary row is
 * linked to its primary by the shared report_id because the Phase 1 schema
 * intentionally has no parent-assignment column.
 */
class SecondaryRoutingService
{
    public const APP_CONFIG_KEY = 'secondary_routing_trigger_map';

    /**
     * These are the only trigger codes emitted by the approved Phase 1 AI
     * prompt. Unknown signals are ignored rather than becoming routing input.
     *
     * @var list<string>
     */
    private const APPROVED_TRIGGERS = [
        'traffic_obstruction',
        'road_damage_by_utility_work',
        'sewage_in_drain',
        'cable_hazard',
        'footpath_damage_by_parking',
    ];

    public function __construct(private readonly AssignmentService $assignments) {}

    /**
     * @param  list<string>  $triggers
     * @return list<ReportAssignment>
     */
    public function route(Report $report, array $triggers, ?User $actor = null, ?string $reason = null): array
    {
        $created = DB::transaction(function () use ($report, $triggers, $actor): array {
            $primary = $report->assignments()
                ->where('is_primary', true)
                ->where('kind', ReportAssignment::KIND_PRIMARY)
                ->open()
                ->whereNull('reassigned_at')
                ->lockForUpdate()
                ->latest('assigned_at')
                ->first();

            // Secondary tasks may only be created for a currently-owned
            // report. In particular, a secondary row must never become the
            // source of truth for reports.department_id.
            if ($primary === null || $report->department_id !== $primary->department_id) {
                return [];
            }

            $mapping = $this->triggerMap();
            $normalizedTriggers = array_values(array_unique(array_filter(
                $triggers,
                static fn (mixed $trigger): bool => is_string($trigger)
                    && in_array($trigger, self::APPROVED_TRIGGERS, true),
            )));

            if ($normalizedTriggers === []) {
                return [];
            }

            $departmentCodes = array_values(array_unique(array_filter(
                array_map(
                    static fn (string $trigger): mixed => $mapping[$trigger] ?? null,
                    $normalizedTriggers,
                ),
                'is_string',
            )));

            if ($departmentCodes === []) {
                return [];
            }

            $departments = Department::query()
                ->where('active', true)
                ->whereIn('code', $departmentCodes)
                ->get()
                ->keyBy('code');

            $assignments = [];

            foreach ($normalizedTriggers as $trigger) {
                $departmentCode = $mapping[$trigger] ?? null;

                if (! is_string($departmentCode)) {
                    continue;
                }

                $department = $departments->get($departmentCode);

                // A secondary department must be distinct from the primary;
                // duplicate active secondary tasks are also not meaningful.
                if ($department === null || $department->id === $primary->department_id) {
                    continue;
                }

                $alreadyAssigned = $report->assignments()
                    ->where('department_id', $department->id)
                    ->where('is_primary', false)
                    ->where('kind', ReportAssignment::KIND_SECONDARY)
                    ->open()
                    ->whereNull('reassigned_at')
                    ->lockForUpdate()
                    ->exists();

                if ($alreadyAssigned) {
                    continue;
                }

                $officer = $this->assignments->pickOfficer($department->id);
                $assignment = ReportAssignment::query()->create([
                    'report_id' => $report->id,
                    'department_id' => $department->id,
                    'is_primary' => false,
                    'kind' => ReportAssignment::KIND_SECONDARY,
                    'officer_id' => $officer?->id,
                    'assigned_by' => $actor?->id,
                    'assigned_at' => now(),
                    'accepted_at' => null,
                    'completed_at' => null,
                    'reassignment_reason' => null,
                    'reassigned_at' => null,
                    'task_status' => ReportAssignment::TASK_STATUS_OPEN,
                    'sla_minutes' => $department->default_sla_minutes,
                ]);

                AuditLog::query()->create([
                    'user_id' => $actor?->id,
                    'entity' => 'reports',
                    'entity_id' => $report->id,
                    'action' => 'report.secondary_assigned',
                    'before' => null,
                    'after' => [
                        'assignment_id' => $assignment->id,
                        'primary_assignment_id' => $primary->id,
                        'department_id' => $assignment->department_id,
                        'kind' => ReportAssignment::KIND_SECONDARY,
                        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
                        'sla_minutes' => $assignment->sla_minutes,
                        'trigger' => $trigger,
                    ],
                    'ip' => null,
                    'device_fingerprint' => null,
                    'request_id' => null,
                    'created_at' => now(),
                ]);

                $assignments[] = [$assignment, $trigger];
            }

            return $assignments;
        });

        $result = [];

        foreach ($created as [$assignment, $trigger]) {
            /** @var ReportAssignment $assignment */
            /** @var string $trigger */
            ReportAssigned::dispatch(
                reportId: $assignment->report_id,
                departmentId: $assignment->department_id,
                officerId: $assignment->officer_id,
                slaMinutes: (int) $assignment->sla_minutes,
                actorId: $actor?->id,
                reason: $reason,
                metadata: [
                    'assignment_id' => $assignment->id,
                    'kind' => ReportAssignment::KIND_SECONDARY,
                    'is_primary' => false,
                    'task_status' => ReportAssignment::TASK_STATUS_OPEN,
                    'trigger' => $trigger,
                ],
            );
            $result[] = $assignment;
        }

        return $result;
    }

    /**
     * @return array<string, string>
     */
    private function triggerMap(): array
    {
        $config = AppConfig::query()->where('key', self::APP_CONFIG_KEY)->first();

        if ($config === null || ! $config->enabled || ! is_array($config->value)) {
            return [];
        }

        $map = [];

        foreach ($config->value as $trigger => $departmentCode) {
            if (is_string($trigger) && is_string($departmentCode)) {
                $map[$trigger] = $departmentCode;
            }
        }

        return $map;
    }
}
