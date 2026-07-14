<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $this->replaceClosePath(
            fromCode: 'resolved',
            toCode: 'closed',
            role: 'department_officer',
            remove: [
                ['resolved', 'verify', 'verified'],
                ['verified', 'close', 'closed'],
            ],
        );

        $this->invalidateWorkflowCache();
    }

    public function down(): void
    {
        $this->replaceClosePath(
            fromCode: 'verified',
            toCode: 'closed',
            role: 'moderator',
            remove: [
                ['resolved', 'close', 'closed'],
            ],
        );

        $this->insertTransition('resolved', 'verify', 'verified', 'moderator', 1440);
        $this->invalidateWorkflowCache();
    }

    /**
     * @param  list<array{string, string, string}>  $remove
     */
    private function replaceClosePath(string $fromCode, string $toCode, string $role, array $remove): void
    {
        if (! Schema::hasTable('workflow_definitions') || ! Schema::hasTable('workflow_states') || ! Schema::hasTable('workflow_transitions')) {
            return;
        }

        foreach ($remove as [$from, $event, $to]) {
            $this->deleteTransition($from, $event, $to);
        }

        $this->insertTransition($fromCode, 'close', $toCode, $role, 4320);
    }

    private function insertTransition(string $fromCode, string $event, string $toCode, string $role, int $slaMinutes): void
    {
        $definitionId = DB::table('workflow_definitions')->where('code', 'civic_default')->value('id');

        if (! is_string($definitionId)) {
            return;
        }

        $fromStateId = DB::table('workflow_states')
            ->where('workflow_definition_id', $definitionId)
            ->where('code', $fromCode)
            ->value('id');
        $toStateId = DB::table('workflow_states')
            ->where('workflow_definition_id', $definitionId)
            ->where('code', $toCode)
            ->value('id');

        if (! is_string($fromStateId) || ! is_string($toStateId)) {
            return;
        }

        $key = [
            'workflow_definition_id' => $definitionId,
            'from_state_id' => $fromStateId,
            'event' => $event,
            'to_state_id' => $toStateId,
        ];
        $values = [
            'required_role' => $role,
            'required_permission' => null,
            'conditions' => null,
            'sla_minutes' => $slaMinutes,
            'notify_before_minutes' => max(15, (int) ($slaMinutes * 0.2)),
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

    private function deleteTransition(string $fromCode, string $event, string $toCode): void
    {
        $definitionId = DB::table('workflow_definitions')->where('code', 'civic_default')->value('id');

        if (! is_string($definitionId)) {
            return;
        }

        $fromStateId = DB::table('workflow_states')
            ->where('workflow_definition_id', $definitionId)
            ->where('code', $fromCode)
            ->value('id');
        $toStateId = DB::table('workflow_states')
            ->where('workflow_definition_id', $definitionId)
            ->where('code', $toCode)
            ->value('id');

        DB::table('workflow_transitions')
            ->where('workflow_definition_id', $definitionId)
            ->where('from_state_id', $fromStateId)
            ->where('event', $event)
            ->where('to_state_id', $toStateId)
            ->delete();
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
