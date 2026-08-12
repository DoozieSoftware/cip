<?php

declare(strict_types=1);

use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Workflow\Models\WorkflowState;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const WINDOW_HOURS = 72;

    public function up(): void
    {
        $this->addReportStatuses();
        $this->alignWorkflow();
        $this->invalidateWorkflowCache();
    }

    public function down(): void
    {
        $this->invalidateWorkflowCache();
    }

    private function addReportStatuses(): void
    {
        $rows = [
            ['code' => 'resolved_pending_verification', 'name' => 'Resolved — Pending Verification', 'color' => '#66BB6A', 'is_terminal' => false, 'sort_order' => 84],
            ['code' => 'reopened', 'name' => 'Reopened', 'color' => '#FF7043', 'is_terminal' => false, 'sort_order' => 86],
        ];

        foreach ($rows as $row) {
            ReportStatus::query()->updateOrCreate(
                ['code' => $row['code']],
                $row + ['description' => null, 'active' => true],
            );
        }
    }

    private function alignWorkflow(): void
    {
        if (! $this->hasWorkflowTables()) {
            return;
        }

        $definitionId = DB::table('workflow_definitions')->where('code', 'civic_default')->value('id');

        if (! is_string($definitionId)) {
            return;
        }

        $states = $this->ensureStates($definitionId);
        $this->removeStaleTransitions($definitionId, $states);
        $this->ensureTransitions($definitionId, $states);
    }

    private function hasWorkflowTables(): bool
    {
        return Schema::hasTable('workflow_definitions')
            && Schema::hasTable('workflow_states')
            && Schema::hasTable('workflow_transitions');
    }

    /**
     * Ensure every state the new transitions touch exists. On a
     * fresh database the seeder has not run yet, so we create the
     * prerequisite states here too (updateOrCreate is a no-op when
     * the seeder already created them).
     *
     * @return array<string, string>
     */
    private function ensureStates(string $definitionId): array
    {
        $codes = [
            'in_progress',
            'resolved',
            'resolved_pending_verification',
            'reopened',
            'verified',
            'closed',
        ];

        $map = [];

        foreach ($codes as $code) {
            $row = WorkflowState::query()->updateOrCreate(
                ['workflow_definition_id' => $definitionId, 'code' => $code],
                ['name' => str_replace('_', ' ', $code), 'active' => true],
            );

            $map[$code] = $row->id;
        }

        return $map;
    }

    /**
     * @param  array<string, string>  $states
     */
    private function removeStaleTransitions(string $definitionId, array $states): void
    {
        // Department close without citizen verification is the P1-06 bug.
        if (isset($states['resolved'], $states['closed'])) {
            DB::table('workflow_transitions')
                ->where('workflow_definition_id', $definitionId)
                ->where('from_state_id', $states['resolved'])
                ->where('to_state_id', $states['closed'])
                ->where('event', 'close')
                ->delete();
        }
    }

    /**
     * @param  array<string, string>  $states
     */
    private function ensureTransitions(string $definitionId, array $states): void
    {
        $wanted = [
            // in_progress -> resolve -> resolved_pending_verification
            ['from' => 'in_progress', 'event' => 'resolve', 'to' => 'resolved_pending_verification', 'role' => 'department_officer', 'sla' => 4320],
            // Citizen verification paths.
            ['from' => 'resolved_pending_verification', 'event' => 'verify', 'to' => 'verified', 'role' => null, 'sla' => null],
            ['from' => 'resolved_pending_verification', 'event' => 'dispute', 'to' => 'reopened', 'role' => null, 'sla' => null],
            // Supervisor review close.
            ['from' => 'resolved_pending_verification', 'event' => 'close', 'to' => 'closed', 'role' => 'moderator', 'sla' => null],
            // Final close after citizen verification.
            ['from' => 'verified', 'event' => 'close', 'to' => 'closed', 'role' => 'moderator', 'sla' => null],
            // Reopened cycle.
            ['from' => 'reopened', 'event' => 'resolve', 'to' => 'resolved_pending_verification', 'role' => 'department_officer', 'sla' => 4320],
        ];

        foreach ($wanted as $w) {
            if (! isset($states[$w['from']], $states[$w['to']])) {
                continue;
            }

            $key = [
                'workflow_definition_id' => $definitionId,
                'from_state_id' => $states[$w['from']],
                'event' => $w['event'],
                'to_state_id' => $states[$w['to']],
            ];
            $values = [
                'required_role' => $w['role'],
                'required_permission' => null,
                'conditions' => null,
                'sla_minutes' => $w['sla'],
                'notify_before_minutes' => $w['sla'] !== null ? (int) max(15, (int) ($w['sla'] * 0.2)) : null,
                'priority' => 0,
                'active' => true,
                'updated_at' => now(),
            ];
            $query = DB::table('workflow_transitions')->where($key);

            if ($query->exists()) {
                $query->update($values);
            } else {
                DB::table('workflow_transitions')->insert($key + $values + [
                    'id' => (string) Str::uuid(),
                    'created_at' => now(),
                ]);
            }
        }
    }

    private function invalidateWorkflowCache(): void
    {
        if (! Schema::hasTable('workflow_definitions')) {
            return;
        }

        $definitionId = DB::table('workflow_definitions')->where('code', 'civic_default')->value('id');
        Cache::forget('workflow:def:code:civic_default');

        if (is_string($definitionId)) {
            Cache::forget("workflow:def:id:{$definitionId}");
        }
    }
};
