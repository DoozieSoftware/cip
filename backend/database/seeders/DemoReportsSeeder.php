<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds a small, clearly-labelled demo queue for the operations portal.
 *
 * These records are not production fixtures. They make a fresh local/demo
 * environment useful immediately after `db:seed` and exercise the Phase 1
 * primary-department queues for the demo officer's two memberships.
 */
class DemoReportsSeeder extends Seeder
{
    /**
     * @var list<array<string, string>>
     */
    private const REPORTS = [
        [
            'tracking_number' => '900001',
            'type' => 'pothole',
            'department' => 'BBMP_ENG',
            'status' => 'assigned',
            'priority' => 'high',
            'title' => 'Demo pothole near MG Road junction',
            'description' => 'Demo report for the Phase 1 department queue.',
        ],
        [
            'tracking_number' => '900002',
            'type' => 'footpath_damage',
            'department' => 'BBMP_ENG',
            'status' => 'accepted',
            'priority' => 'medium',
            'title' => 'Demo damaged footpath near bus stop',
            'description' => 'Demo report for the Phase 1 department queue.',
        ],
        [
            'tracking_number' => '900003',
            'type' => 'traffic_violation',
            'department' => 'BTP',
            'status' => 'in_progress',
            'priority' => 'high',
            'title' => 'Demo traffic obstruction at junction',
            'description' => 'Demo report for the Phase 1 department queue.',
        ],
        [
            'tracking_number' => '900004',
            'type' => 'streetlight',
            'department' => 'BBMP_ELEC',
            'status' => 'resolved',
            'priority' => 'medium',
            'title' => 'Demo streetlight outage',
            'description' => 'Demo report for the Phase 1 department queue.',
        ],
    ];

    public function run(): void
    {
        $citizen = User::query()->where('mobile', '9999900001')->first();
        $officer = User::query()->where('mobile', '9999900003')->first();
        $workflowId = WorkflowDefinition::query()->where('code', 'civic_default')->value('id');

        if ($citizen === null || $officer === null || ! is_string($workflowId)) {
            return;
        }

        DB::transaction(function () use ($citizen, $officer, $workflowId): void {
            foreach (self::REPORTS as $row) {
                $department = Department::query()->where('code', $row['department'])->first();
                $type = ReportType::query()->where('code', $row['type'])->first();
                $status = ReportStatus::query()->where('code', $row['status'])->first();
                $priority = ReportPriority::query()->where('code', $row['priority'])->first();

                if ($department === null || $type === null || $status === null || $priority === null) {
                    continue;
                }

                $trackingNumber = 'CIV-'.date('Y').'-'.$row['tracking_number'];
                $report = Report::query()->where('tracking_number', $trackingNumber)->first();

                if ($report === null) {
                    $report = Report::query()->create([
                        'tracking_number' => $trackingNumber,
                        'citizen_id' => $citizen->id,
                        'report_type_id' => $type->id,
                        'department_id' => $department->id,
                        'current_status_id' => $status->id,
                        'priority_id' => $priority->id,
                        'workflow_id' => $workflowId,
                        'location_id' => Location::factory()->create()->id,
                        'assigned_to' => $officer->id,
                        'title' => $row['title'],
                        'description' => $row['description'],
                        'ai_confidence' => 0.97,
                        'ai_label' => $type->code,
                        'is_anonymous' => false,
                        'is_verified' => true,
                        'submitted_at' => now()->subHours(3),
                    ]);
                } else {
                    $report->update([
                        'citizen_id' => $citizen->id,
                        'report_type_id' => $type->id,
                        'department_id' => $department->id,
                        'current_status_id' => $status->id,
                        'priority_id' => $priority->id,
                        'workflow_id' => $workflowId,
                        'assigned_to' => $officer->id,
                        'title' => $row['title'],
                        'description' => $row['description'],
                    ]);
                }

                ReportAssignment::query()->updateOrCreate(
                    [
                        'report_id' => $report->id,
                        'is_primary' => true,
                    ],
                    [
                        'department_id' => $department->id,
                        'kind' => ReportAssignment::KIND_PRIMARY,
                        'officer_id' => $officer->id,
                        'assigned_by' => null,
                        'assigned_at' => now()->subHours(3),
                        'accepted_at' => in_array($row['status'], ['accepted', 'in_progress', 'resolved'], true) ? now()->subHours(2) : null,
                        'completed_at' => $row['status'] === 'resolved' ? now()->subHour() : null,
                        'task_status' => $row['status'] === 'resolved'
                            ? ReportAssignment::TASK_STATUS_COMPLETED
                            : ReportAssignment::TASK_STATUS_OPEN,
                        'sla_minutes' => $row['priority'] === 'high' ? 480 : 1440,
                    ],
                );
            }
        });
    }
}
