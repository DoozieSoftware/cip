<?php

declare(strict_types=1);

use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * WF-01 — align the `civic_default` workflow with the canonical lifecycle.
 *
 * The previous seeder and the 2026_07_14 / 2026_08_07 migrations
 * fought each other: the seeder re-added `resolved -> close -> closed`
 * after the migration removed it, and deleted `verified -> close -> closed`
 * that the migration had added. The result was a graph where:
 *
 *  - `verified` had no incoming executable transition
 *  - `escalated` had no exit
 *  - `resolved` could close without citizen verification
 *
 * This migration reconciles the graph to match the seeder's current
 * canonical set. Idempotent: safe to run on an already-aligned DB.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $def = WorkflowDefinition::query()->where('code', 'civic_default')->first();

            if ($def === null) {
                return;
            }

            $this->ensureReportStatuses();
            $this->removeStaleTransitions($def->id);
            $this->ensureStates($def->id);
            $this->ensureTransitions($def->id);

            Cache::forget('workflow:def:code:civic_default');
            Cache::forget("workflow:def:id:{$def->id}");
        });
    }

    public function down(): void
    {
        // No-op: the seeder is the canonical source; reverting would
        // reintroduce the WF-01 bugs.
    }

    private function ensureReportStatuses(): void
    {
        $rows = [
            ['code' => 'resolved_pending_verification', 'name' => 'Resolved — Pending Verification', 'color' => '#66BB6A', 'is_terminal' => false, 'sort_order' => 80],
            ['code' => 'reopened',                     'name' => 'Reopened',                     'color' => '#FF7043', 'is_terminal' => false, 'sort_order' => 87],
        ];

        foreach ($rows as $row) {
            ReportStatus::query()->updateOrCreate(
                ['code' => $row['code']],
                $row + ['description' => null, 'active' => true],
            );
        }
    }

    private function removeStaleTransitions(string $definitionId): void
    {
        // Remove the obsolete `resolved -> close -> closed` path that
        // let a department close without citizen verification.
        $resolved = WorkflowState::query()
            ->where('workflow_definition_id', $definitionId)
            ->where('code', 'resolved')
            ->first();
        $closed = WorkflowState::query()
            ->where('workflow_definition_id', $definitionId)
            ->where('code', 'closed')
            ->first();

        if ($resolved !== null && $closed !== null) {
            DB::table('workflow_transitions')
                ->where('workflow_definition_id', $definitionId)
                ->where('from_state_id', $resolved->id)
                ->where('to_state_id', $closed->id)
                ->where('event', 'close')
                ->delete();
        }

        // Remove the obsolete `in_progress -> resolve -> resolved` path
        // (replaced by `in_progress -> resolve -> resolved_pending_verification`).
        $inProgress = WorkflowState::query()
            ->where('workflow_definition_id', $definitionId)
            ->where('code', 'in_progress')
            ->first();

        if ($inProgress !== null && $resolved !== null) {
            DB::table('workflow_transitions')
                ->where('workflow_definition_id', $definitionId)
                ->where('from_state_id', $inProgress->id)
                ->where('to_state_id', $resolved->id)
                ->where('event', 'resolve')
                ->delete();
        }
    }

    private function ensureStates(string $definitionId): void
    {
        $rows = [
            ['code' => 'resolved_pending_verification', 'name' => 'Resolved — Pending Verification', 'is_initial' => false, 'is_terminal' => false, 'sort_order' => 80, 'color' => '#66BB6A'],
            ['code' => 'reopened',                     'name' => 'Reopened',                     'is_initial' => false, 'is_terminal' => false, 'sort_order' => 87, 'color' => '#FF7043'],
        ];

        foreach ($rows as $row) {
            WorkflowState::query()->updateOrCreate(
                ['workflow_definition_id' => $definitionId, 'code' => $row['code']],
                $row + ['description' => null, 'active' => true],
            );
        }
    }

    private function ensureTransitions(string $definitionId): void
    {
        $codes = [
            'in_progress',
            'resolved_pending_verification',
            'verified',
            'reopened',
            'closed',
            'pending_moderator',
            'assigned',
            'escalated',
        ];

        $map = [];

        foreach ($codes as $code) {
            $row = WorkflowState::query()
                ->where('workflow_definition_id', $definitionId)
                ->where('code', $code)
                ->first();

            if ($row !== null) {
                $map[$code] = $row->id;
            }
        }

        $wanted = [
            // Citizen verification paths (verify has no role gate — citizen action).
            ['from' => 'resolved_pending_verification', 'event' => 'verify',       'to' => 'verified',                     'role' => null,                    'sla' => 2880],
            ['from' => 'resolved_pending_verification', 'event' => 'dispute',      'to' => 'reopened',                     'role' => null,                    'sla' => null],
            // Supervisor override close from pending verification.
            ['from' => 'resolved_pending_verification', 'event' => 'close',        'to' => 'closed',                       'role' => 'moderator',             'sla' => null],
            // Final close after citizen verification.
            ['from' => 'verified',                     'event' => 'close',        'to' => 'closed',                       'role' => 'moderator',             'sla' => null],
            // Reopened cycle.
            ['from' => 'reopened',                     'event' => 'resolve',      'to' => 'resolved_pending_verification', 'role' => 'department_officer',   'sla' => 4320],
            // Supervisor escalation exit.
            ['from' => 'escalated',                    'event' => 'review',       'to' => 'pending_moderator',            'role' => 'moderator',             'sla' => 240],
            ['from' => 'escalated',                    'event' => 'assign',       'to' => 'assigned',                     'role' => 'moderator',             'sla' => 240],
        ];

        foreach ($wanted as $w) {
            if (! isset($map[$w['from']], $map[$w['to']])) {
                continue;
            }

            $key = [
                'workflow_definition_id' => $definitionId,
                'from_state_id' => $map[$w['from']],
                'event' => $w['event'],
                'to_state_id' => $map[$w['to']],
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
};
