<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Aligns persisted routing rules with the broad citizen-facing catalog.
 *
 * Internal AI labels retain the finer routing distinctions, while the eight
 * citizen categories provide deterministic fallbacks when no label exists.
 */
return new class extends Migration
{
    /**
     * @var list<array{name: string, conditions: array<string, list<string>>, department: string, priority: string, sla: int, order: int}>
     */
    private const RULES = [
        ['name' => 'Tree Fall -> BBMP Forest', 'conditions' => ['ai_label_in' => ['tree_fall']], 'department' => 'BBMP_FOR', 'priority' => 'high', 'sla' => 720, 'order' => 10],
        ['name' => 'Stray Animal -> BBMP Animal Husbandry', 'conditions' => ['ai_label_in' => ['stray_animal']], 'department' => 'BBMP_AH', 'priority' => 'medium', 'sla' => 1440, 'order' => 11],
        ['name' => 'Streetlight -> BBMP Electrical', 'conditions' => ['ai_label_in' => ['streetlight']], 'department' => 'BBMP_ELEC', 'priority' => 'medium', 'sla' => 1440, 'order' => 12],
        ['name' => 'Power Outage -> BESCOM', 'conditions' => ['ai_label_in' => ['power_outage']], 'department' => 'BESCOM', 'priority' => 'high', 'sla' => 720, 'order' => 13],
        ['name' => 'Water Leak -> BWSSB', 'conditions' => ['ai_label_in' => ['water_leakage']], 'department' => 'BWSSB', 'priority' => 'high', 'sla' => 720, 'order' => 14],
        ['name' => 'Sewage Overflow -> BWSSB', 'conditions' => ['ai_label_in' => ['sewage_overflow']], 'department' => 'BWSSB', 'priority' => 'high', 'sla' => 720, 'order' => 15],
        ['name' => 'Drain Blockage -> BBMP SWD', 'conditions' => ['ai_label_in' => ['drain_blockage']], 'department' => 'BBMP_SWD', 'priority' => 'medium', 'sla' => 1440, 'order' => 16],
        ['name' => 'Noise Pollution -> KSPCB', 'conditions' => ['ai_label_in' => ['noise_pollution']], 'department' => 'KSPCB', 'priority' => 'medium', 'sla' => 2880, 'order' => 17],
        ['name' => 'Road Detail -> BBMP Roads', 'conditions' => ['ai_label_in' => ['pothole', 'footpath_damage', 'road_damage']], 'department' => 'BBMP_ENG', 'priority' => 'medium', 'sla' => 1440, 'order' => 18],
        ['name' => 'Roads -> BBMP Roads', 'conditions' => ['category_in' => ['roads']], 'department' => 'BBMP_ENG', 'priority' => 'medium', 'sla' => 1440, 'order' => 20],
        ['name' => 'Water & Sewage -> BWSSB', 'conditions' => ['category_in' => ['water_sewage']], 'department' => 'BWSSB', 'priority' => 'high', 'sla' => 720, 'order' => 21],
        ['name' => 'Electricity -> BESCOM', 'conditions' => ['category_in' => ['electricity']], 'department' => 'BESCOM', 'priority' => 'high', 'sla' => 720, 'order' => 22],
        ['name' => 'Garbage & Dead Animal -> BBMP SWM', 'conditions' => ['category_in' => ['garbage', 'dead_animal']], 'department' => 'BBMP_SWM', 'priority' => 'medium', 'sla' => 1440, 'order' => 23],
        ['name' => 'Traffic & Parking -> BTP', 'conditions' => ['category_in' => ['traffic_violation', 'illegal_parking']], 'department' => 'BTP', 'priority' => 'high', 'sla' => 480, 'order' => 24],
        ['name' => 'Encroachment -> BBMP Town Planning', 'conditions' => ['category_in' => ['encroachment']], 'department' => 'BBMP_TP', 'priority' => 'medium', 'sla' => 2880, 'order' => 25],
    ];

    public function up(): void
    {
        $now = now();
        $departments = DB::table('departments')->pluck('id', 'code');
        $priorities = DB::table('report_priorities')->pluck('id', 'code');

        foreach (self::RULES as $rule) {
            $departmentId = $departments[$rule['department']] ?? null;
            $priorityId = $priorities[$rule['priority']] ?? null;

            if ($departmentId === null || $priorityId === null) {
                continue;
            }

            $attributes = [
                'conditions' => json_encode($rule['conditions']),
                'destination_department_id' => $departmentId,
                'default_officer_id' => null,
                'default_priority_id' => $priorityId,
                'default_sla_minutes' => $rule['sla'],
                'priority' => $rule['order'],
                'description' => 'Bangalore sample routing rule.',
                'active' => true,
                'deleted_at' => null,
                'updated_at' => $now,
            ];

            $existing = DB::table('routing_rules')
                ->where('name', $rule['name'])
                ->value('id');

            if ($existing === null) {
                DB::table('routing_rules')->insert(array_merge($attributes, [
                    'id' => (string) Str::orderedUuid(),
                    'name' => $rule['name'],
                    'created_at' => $now,
                ]));

                continue;
            }

            DB::table('routing_rules')
                ->where('id', $existing)
                ->update($attributes);
        }

        DB::table('routing_rules')
            ->whereIn('name', [
                'Garbage -> BBMP Ward 112',
                'Roads, Water & Electricity -> BBMP Ward 112',
                'Traffic & Parking -> BTP',
                'Dead Animal -> BBMP Ward 112',
                'Pothole -> BBMP Ward 112',
                'Pothole -> BBMP Roads',
                'Footpath -> BBMP Roads',
                'Garbage -> BBMP SWM',
                'Dead Animal -> BBMP SWM',
                'Streetlight -> BBMP Electrical',
                'Power Outage -> BESCOM',
                'Water Leak -> BWSSB',
                'Sewage Overflow -> BWSSB',
                'Drain Blockage -> BBMP SWD',
                'Traffic Violation -> BTP',
                'Illegal Parking -> BTP',
                'Tree Fall -> BBMP Forest',
                'Stray Animal -> BBMP Animal Husbandry',
                'Encroachment -> BBMP Town Planning',
                'Noise Pollution -> KSPCB',
            ])
            ->whereNotIn('name', array_column(self::RULES, 'name'))
            ->update(['active' => false, 'updated_at' => $now]);
    }

    public function down(): void
    {
        // Routing data is append-only operational configuration. The seeder
        // can restore the current canonical set after a rollback.
    }
};
