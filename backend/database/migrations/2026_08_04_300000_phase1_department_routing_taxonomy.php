<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Phase 1 department-wise routing foundation per
 * docs/department-routing-implementation-plan.md and the approved mapping
 * in docs/department-routing-mapping.md.
 *
 *  1. Seeds the approved department master:
 *     - 10 BBMP wings (children of BBMP via parent_id)
 *     - KSPCB, BMTC, PWD, BDA external agencies
 *     - deactivates demo-only BBMP_WARD_112 / BTP_TRAFFIC departments
 *  2. Activates the 15 approved complaint categories and deactivates the
 *     merged-away ones (roads, water_sewage, electricity) — historical
 *     reports keep their codes.
 *  3. Rewrites routing rules: one category_in rule per approved category,
 *     re-points the routing fallback to BBMP_ENG, deactivates legacy rules.
 *  4. Bumps the category_classifier prompt (v5) to the 15-code taxonomy.
 *
 * SLA minutes are provisional defaults (open item O1 in the plan) and stay
 * editable via the Super Admin routing-rules UI.
 */
return new class extends Migration
{
    /**
     * @var list<array<string, mixed>>
     */
    private const BBMP_WINGS = [
        ['code' => 'BBMP_ENG', 'name' => 'BBMP Roads & Infrastructure (Engineering)', 'sla' => 1440],
        ['code' => 'BBMP_SWM', 'name' => 'BBMP Solid Waste Management (BSWML)', 'sla' => 1440],
        ['code' => 'BBMP_ELEC', 'name' => 'BBMP Electrical — Streetlight & Park Lighting', 'sla' => 1440],
        ['code' => 'BBMP_SWD', 'name' => 'BBMP Storm Water Drains & Lakes', 'sla' => 1440],
        ['code' => 'BBMP_HLTH', 'name' => 'BBMP Health Department', 'sla' => 1440],
        ['code' => 'BBMP_AH', 'name' => 'BBMP Animal Husbandry', 'sla' => 1440],
        ['code' => 'BBMP_FOR', 'name' => 'BBMP Forest Cell / Forest & Horticulture', 'sla' => 1440],
        ['code' => 'BBMP_TP', 'name' => 'BBMP Town Planning', 'sla' => 2880],
        ['code' => 'BBMP_PRK', 'name' => 'BBMP Parks & Playgrounds (Horticulture)', 'sla' => 1440],
        ['code' => 'BBMP_LAKE', 'name' => 'BBMP Lakes Department', 'sla' => 2880],
    ];

    /**
     * @var list<array<string, mixed>>
     */
    private const EXTERNAL_AGENCIES = [
        [
            'code' => 'KSPCB',
            'name' => 'Karnataka State Pollution Control Board',
            'sla' => 2880,
            'phone' => '080-25589112', // provisional — verify before public display (plan O1)
        ],
        [
            'code' => 'BMTC',
            'name' => 'Bangalore Metropolitan Transport Corporation Limited',
            'sla' => 1440,
            'phone' => '1800-425-1663',
        ],
        [
            'code' => 'PWD',
            'name' => 'Public Works Department, Government of Karnataka',
            'sla' => 2880,
            'phone' => '080-22211283', // provisional — verify before public display (plan O1)
        ],
        [
            'code' => 'BDA',
            'name' => 'Bangalore Development Authority',
            'sla' => 2880,
            'phone' => '080-23360825', // provisional — verify before public display (plan O1)
        ],
    ];

    public function up(): void
    {
        $now = now();

        $this->seedDepartments($now);
        $this->restructureCategories($now);
        $this->restructureRoutingRules($now);
        $this->repointFallback();
        $this->bumpClassifierPrompt();
    }

    public function down(): void
    {
        $now = now();

        DB::table('routing_rules')
            ->whereIn('name', array_column($this->ruleDefinitions(), 'name'))
            ->update(['active' => false, 'updated_at' => $now]);

        DB::table('routing_rules')
            ->whereIn('name', [
                'Garbage -> BBMP Ward 112',
                'Roads, Water & Electricity -> BBMP Ward 112',
                'Traffic & Parking -> BTP',
                'Dead Animal -> BBMP Ward 112',
            ])
            ->update(['active' => true, 'updated_at' => $now]);

        DB::table('report_types')
            ->whereIn('code', ['roads', 'water_sewage', 'electricity'])
            ->update(['active' => true, 'updated_at' => $now]);

        DB::table('report_types')
            ->whereIn('code', $this->newCategoryCodes())
            ->update(['active' => false, 'sort_order' => 0, 'updated_at' => $now]);

        DB::table('departments')
            ->whereIn('code', ['BBMP_WARD_112', 'BTP_TRAFFIC'])
            ->update(['active' => true, 'updated_at' => $now]);

        DB::table('departments')
            ->whereIn('code', array_merge(
                array_column(self::BBMP_WINGS, 'code'),
                array_column(self::EXTERNAL_AGENCIES, 'code'),
            ))
            ->update(['active' => false, 'updated_at' => $now]);
    }

    private function seedDepartments(Carbon $now): void
    {
        $bbmpId = DB::table('departments')->where('code', 'BBMP')->value('id');

        $workingHours = json_encode([
            'mon' => ['09:00', '17:30'],
            'tue' => ['09:00', '17:30'],
            'wed' => ['09:00', '17:30'],
            'thu' => ['09:00', '17:30'],
            'fri' => ['09:00', '17:30'],
            'sat' => ['09:00', '13:00'],
        ]);
        $holidays = json_encode([
            '2026-01-26', '2026-08-15', '2026-10-02',
            '2026-11-01', '2026-11-08', '2026-12-25',
        ]);
        $bbmpEscalation = json_encode([
            ['after_minutes' => 1440, 'escalate_to' => 'BBMP-ZONAL'],
            ['after_minutes' => 4320, 'escalate_to' => 'BBMP-COMMISSIONER'],
        ]);

        foreach (self::BBMP_WINGS as $wing) {
            $this->upsertDepartment([
                'code' => $wing['code'],
                'name' => $wing['name'],
                'jurisdiction' => 'BBMP, Bengaluru',
                'parent_id' => $bbmpId,
                'default_sla_minutes' => $wing['sla'],
                'working_hours' => $workingHours,
                'holiday_calendar' => $holidays,
                'escalation_matrix' => $bbmpEscalation,
            ], $now);
        }

        foreach (self::EXTERNAL_AGENCIES as $agency) {
            $this->upsertDepartment([
                'code' => $agency['code'],
                'name' => $agency['name'],
                'jurisdiction' => 'Bengaluru Urban',
                'parent_id' => null,
                'phone' => $agency['phone'],
                'default_sla_minutes' => $agency['sla'],
                'working_hours' => $workingHours,
                'holiday_calendar' => $holidays,
                'escalation_matrix' => json_encode([]),
            ], $now);
        }

        // Demo-only departments from the ward-112 proof-of-concept. Reports
        // already assigned to them keep their history; no new routing targets
        // them and the fallback is re-pointed below.
        DB::table('departments')
            ->whereIn('code', ['BBMP_WARD_112', 'BTP_TRAFFIC'])
            ->update(['active' => false, 'updated_at' => $now]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function upsertDepartment(array $attributes, Carbon $now): void
    {
        $code = $attributes['code'];
        unset($attributes['code']);

        $attributes['updated_at'] = $now;

        $existing = DB::table('departments')->where('code', $code)->value('id');

        if ($existing === null) {
            DB::table('departments')->insert(array_merge($attributes, [
                'id' => (string) Str::orderedUuid(),
                'code' => $code,
                'active' => true,
                'created_at' => $now,
            ]));

            return;
        }

        DB::table('departments')->where('code', $code)->update($attributes);
    }

    private function restructureCategories(Carbon $now): void
    {
        // Approved mapping order (docs/department-routing-mapping.md §4).
        $types = [
            ['code' => 'pothole', 'name' => 'Road Pothole / Damage', 'icon' => 'road', 'color' => '#3F51B5', 'order' => 1],
            ['code' => 'footpath_damage', 'name' => 'Damaged Footpath', 'icon' => 'walk', 'color' => '#455A64', 'order' => 2],
            ['code' => 'garbage', 'name' => 'Uncollected / Open Garbage', 'icon' => 'trash', 'color' => '#795548', 'order' => 3],
            ['code' => 'dead_animal', 'name' => 'Dead Animal Disposal', 'icon' => 'alert', 'color' => '#212121', 'order' => 4],
            ['code' => 'streetlight', 'name' => 'Non-Functional Streetlight', 'icon' => 'bulb', 'color' => '#FFC107', 'order' => 5],
            ['code' => 'power_outage', 'name' => 'Power Outage / Transformer', 'icon' => 'zap', 'color' => '#F4511E', 'order' => 6],
            ['code' => 'water_leakage', 'name' => 'Water Pipeline Burst / Leak', 'icon' => 'droplet', 'color' => '#03A9F4', 'order' => 7],
            ['code' => 'sewage_overflow', 'name' => 'Sewage Overflow / Manhole', 'icon' => 'droplet', 'color' => '#01579B', 'order' => 8],
            ['code' => 'drain_blockage', 'name' => 'Storm Water Drain Blockage', 'icon' => 'droplet', 'color' => '#00838F', 'order' => 9],
            ['code' => 'traffic_violation', 'name' => 'Traffic Violation / Congestion', 'icon' => 'traffic', 'color' => '#D32F2F', 'order' => 10],
            ['code' => 'illegal_parking', 'name' => 'Illegal / Footpath Parking', 'icon' => 'parking', 'color' => '#FF5722', 'order' => 11],
            ['code' => 'tree_fall', 'name' => 'Fallen Tree / Overhanging Branch', 'icon' => 'tree', 'color' => '#2E7D32', 'order' => 12],
            ['code' => 'stray_animal', 'name' => 'Stray Dog / Animal Menace', 'icon' => 'alert', 'color' => '#6D4C41', 'order' => 13],
            ['code' => 'encroachment', 'name' => 'Public Property Encroachment', 'icon' => 'fence', 'color' => '#6A1B9A', 'order' => 14],
            ['code' => 'noise_pollution', 'name' => 'Industrial / Commercial Noise', 'icon' => 'volume', 'color' => '#5C6BC0', 'order' => 15],
        ];

        foreach ($types as $type) {
            $attributes = [
                'name' => $type['name'],
                'description' => 'Approved Bengaluru routing category for '.$type['name'].'.',
                'icon' => $type['icon'],
                'color' => $type['color'],
                'sort_order' => $type['order'],
                'requires_video' => false,
                'requires_photo' => true,
                'min_photos' => 1,
                'max_photos' => 5,
                'active' => true,
                'updated_at' => $now,
            ];

            $existing = DB::table('report_types')->where('code', $type['code'])->value('id');

            if ($existing === null) {
                DB::table('report_types')->insert(array_merge($attributes, [
                    'id' => (string) Str::orderedUuid(),
                    'code' => $type['code'],
                    'created_at' => $now,
                ]));

                continue;
            }

            DB::table('report_types')->where('code', $type['code'])->update($attributes);
        }

        // Superseded by the finer-grained set above; history preserved.
        DB::table('report_types')
            ->whereIn('code', ['roads', 'water_sewage', 'electricity'])
            ->update(['active' => false, 'sort_order' => 0, 'updated_at' => $now]);
    }

    private function restructureRoutingRules(Carbon $now): void
    {
        $departments = DB::table('departments')->pluck('id', 'code');
        $priorities = DB::table('report_priorities')->pluck('id', 'code');

        $medium = $priorities['medium'] ?? null;
        $high = $priorities['high'] ?? null;

        if ($medium === null || $high === null) {
            return;
        }

        foreach ($this->ruleDefinitions() as $rule) {
            $destination = $departments[$rule['department']] ?? null;

            if ($destination === null) {
                continue;
            }

            $existing = DB::table('routing_rules')->where('name', $rule['name'])->value('id');

            $attributes = [
                'conditions' => json_encode(['category_in' => [$rule['category']]]),
                'destination_department_id' => $destination,
                'default_priority_id' => $rule['priority'] === 'high' ? $high : $medium,
                'default_officer_id' => null,
                'default_sla_minutes' => $rule['sla'],
                'priority' => $rule['order'],
                'description' => $rule['description'],
                'active' => true,
                'updated_at' => $now,
            ];

            if ($existing === null) {
                DB::table('routing_rules')->insert(array_merge($attributes, [
                    'id' => (string) Str::orderedUuid(),
                    'name' => $rule['name'],
                    'created_at' => $now,
                ]));

                continue;
            }

            DB::table('routing_rules')->where('name', $rule['name'])->update($attributes);
        }

        DB::table('routing_rules')
            ->whereIn('name', [
                'Garbage -> BBMP Ward 112',
                'Roads, Water & Electricity -> BBMP Ward 112',
                'Traffic & Parking -> BTP',
                'Dead Animal -> BBMP Ward 112',
            ])
            ->update(['active' => false, 'updated_at' => $now]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function ruleDefinitions(): array
    {
        return [
            ['name' => 'Pothole -> BBMP Roads', 'category' => 'pothole', 'department' => 'BBMP_ENG', 'priority' => 'medium', 'sla' => 1440, 'order' => 10, 'description' => 'Road potholes and surface damage — BBMP Engineering.'],
            ['name' => 'Footpath -> BBMP Roads', 'category' => 'footpath_damage', 'department' => 'BBMP_ENG', 'priority' => 'medium', 'sla' => 1440, 'order' => 11, 'description' => 'Damaged footpaths and curbs — BBMP Engineering.'],
            ['name' => 'Garbage -> BBMP SWM', 'category' => 'garbage', 'department' => 'BBMP_SWM', 'priority' => 'medium', 'sla' => 1440, 'order' => 12, 'description' => 'Uncollected/open garbage — BBMP Solid Waste Management.'],
            ['name' => 'Dead Animal -> BBMP SWM', 'category' => 'dead_animal', 'department' => 'BBMP_SWM', 'priority' => 'medium', 'sla' => 1440, 'order' => 13, 'description' => 'Carcass disposal — BBMP SWM (Animal Husbandry assists).'],
            ['name' => 'Streetlight -> BBMP Electrical', 'category' => 'streetlight', 'department' => 'BBMP_ELEC', 'priority' => 'medium', 'sla' => 1440, 'order' => 14, 'description' => 'Streetlights are BBMP-owned fixtures, not BESCOM.'],
            ['name' => 'Power Outage -> BESCOM', 'category' => 'power_outage', 'department' => 'BESCOM', 'priority' => 'high', 'sla' => 720, 'order' => 15, 'description' => 'Supply outages, transformers, hanging wires — BESCOM.'],
            ['name' => 'Water Leak -> BWSSB', 'category' => 'water_leakage', 'department' => 'BWSSB', 'priority' => 'high', 'sla' => 720, 'order' => 16, 'description' => 'Pipeline bursts and supply leaks — BWSSB.'],
            ['name' => 'Sewage Overflow -> BWSSB', 'category' => 'sewage_overflow', 'department' => 'BWSSB', 'priority' => 'high', 'sla' => 720, 'order' => 17, 'description' => 'Sewer overflows and manholes — BWSSB.'],
            ['name' => 'Drain Blockage -> BBMP SWD', 'category' => 'drain_blockage', 'department' => 'BBMP_SWD', 'priority' => 'medium', 'sla' => 1440, 'order' => 18, 'description' => 'Storm water drains (rajakaluve) — BBMP SWD, not BWSSB.'],
            ['name' => 'Traffic Violation -> BTP', 'category' => 'traffic_violation', 'department' => 'BTP', 'priority' => 'high', 'sla' => 480, 'order' => 19, 'description' => 'Traffic violations and congestion — Bengaluru Traffic Police.'],
            ['name' => 'Illegal Parking -> BTP', 'category' => 'illegal_parking', 'department' => 'BTP', 'priority' => 'high', 'sla' => 480, 'order' => 20, 'description' => 'Illegal parking and towing — Bengaluru Traffic Police.'],
            ['name' => 'Tree Fall -> BBMP Forest', 'category' => 'tree_fall', 'department' => 'BBMP_FOR', 'priority' => 'high', 'sla' => 720, 'order' => 21, 'description' => 'Fallen trees and hazardous branches — BBMP Forest Cell.'],
            ['name' => 'Stray Animal -> BBMP Animal Husbandry', 'category' => 'stray_animal', 'department' => 'BBMP_AH', 'priority' => 'medium', 'sla' => 1440, 'order' => 22, 'description' => 'Stray dog/cattle menace — BBMP Animal Husbandry.'],
            ['name' => 'Encroachment -> BBMP Town Planning', 'category' => 'encroachment', 'department' => 'BBMP_TP', 'priority' => 'medium', 'sla' => 2880, 'order' => 23, 'description' => 'Encroachment on public property — BBMP Town Planning.'],
            ['name' => 'Noise Pollution -> KSPCB', 'category' => 'noise_pollution', 'department' => 'KSPCB', 'priority' => 'medium', 'sla' => 2880, 'order' => 24, 'description' => 'Industrial/commercial noise — Karnataka State Pollution Control Board.'],
        ];
    }

    /**
     * @return list<string>
     */
    private function newCategoryCodes(): array
    {
        return [
            'footpath_damage', 'power_outage', 'sewage_overflow', 'drain_blockage',
            'tree_fall', 'stray_animal', 'noise_pollution',
        ];
    }

    private function repointFallback(): void
    {
        $bbmpEng = DB::table('departments')->where('code', 'BBMP_ENG')->value('id');

        if ($bbmpEng === null) {
            return;
        }

        DB::table('app_configs')
            ->where('key', 'routing_default_department_id')
            ->update([
                'value' => json_encode(['department_id' => $bbmpEng]),
                'enabled' => true,
                'updated_at' => now(),
            ]);
    }

    private function bumpClassifierPrompt(): void
    {
        $categoryCodes = DB::table('report_types')
            ->where('active', true)
            ->whereNull('deleted_at')
            ->orderBy('sort_order')
            ->pluck('code')
            ->filter(static fn (mixed $code): bool => is_string($code))
            ->values()
            ->all();

        if ($categoryCodes === []) {
            return;
        }

        $base = DB::table('prompt_versions')
            ->where('name', 'category_classifier')
            ->orderByDesc('version')
            ->first();

        if ($base === null) {
            return;
        }

        if (! is_numeric($base->version)) {
            return;
        }

        $nextVersion = ((int) $base->version) + 1;

        $exists = DB::table('prompt_versions')
            ->where('name', 'category_classifier')
            ->where('version', $nextVersion)
            ->exists();

        if ($exists) {
            return;
        }

        $text = is_string($base->prompt_text) ? $base->prompt_text : '';

        $replaced = preg_replace(
            '/Configured category codes: [^.]*\./',
            'Configured category codes: '.implode(', ', $categoryCodes).'.',
            $text,
            1,
        );

        if (is_string($replaced)) {
            $text = $replaced;
        }

        $text = str_replace(
            'Match ONLY the PRIMARY civic issue type (e.g., roads, garbage, electricity)',
            'Match ONLY the PRIMARY civic issue type (e.g., pothole, garbage, streetlight, power_outage)',
            $text,
        );
        $text = str_replace(
            'citizen claims roads but image shows garbage, dead animal, or electricity',
            'citizen claims pothole but image shows garbage, dead animal, or streetlight',
            $text,
        );

        $now = now();

        DB::table('prompt_versions')->insert([
            'id' => (string) Str::uuid(),
            'name' => 'category_classifier',
            'version' => $nextVersion,
            'purpose' => $base->purpose,
            'provider_code' => $base->provider_code,
            'prompt_text' => $text,
            'expected_json_schema' => $base->expected_json_schema,
            'status' => 'approved',
            'approved_by' => null,
            'approved_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('prompt_versions')
            ->where('name', 'category_classifier')
            ->where('status', 'approved')
            ->where('version', '!=', $nextVersion)
            ->update(['status' => 'deprecated']);
    }
};
