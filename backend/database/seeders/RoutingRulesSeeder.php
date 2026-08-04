<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Repositories\RoutingRepository;
use App\Modules\Routing\Services\RoutingFallbackService;
use App\Modules\Settings\Models\AppConfig;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the Phase 1 Bengaluru routing rules per
 * docs/department-routing-mapping.md §4 (approved taxonomy):
 *
 *   - 15 category_in rules, one per approved category, targeting the
 *     responsible BBMP wing or external agency
 *   - legacy demo rules (BBMP_WARD_112 / merged categories) deactivated
 *   - fallback `routing_default_department_id` -> BBMP_ENG
 *
 * The seeder is idempotent: every rule is matched on `(name)` via
 * `updateOrCreate` so re-running is a no-op. Destination departments must
 * already exist (DepartmentsSeeder runs first in DatabaseSeeder).
 */
class RoutingRulesSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $medium = ReportPriority::query()->where('code', 'medium')->firstOrFail();
            $high = ReportPriority::query()->where('code', 'high')->firstOrFail();

            $departments = Department::query()
                ->whereIn('code', [
                    'BBMP_ENG', 'BBMP_SWM', 'BBMP_ELEC', 'BBMP_SWD', 'BBMP_TP',
                    'BBMP_FOR', 'BBMP_AH', 'BTP', 'BWSSB', 'BESCOM', 'KSPCB',
                ])
                ->get()
                ->keyBy('code');

            // Approved taxonomy (docs/department-routing-mapping.md §4).
            // Names match the taxonomy migration exactly (case-insensitive
            // collation makes divergent names collide with migration rows).
            $rules = [
                ['name' => 'Pothole -> BBMP Roads', 'category' => 'pothole', 'code' => 'BBMP_ENG', 'priority' => $medium, 'sla' => 1440, 'order' => 10],
                ['name' => 'Footpath -> BBMP Roads', 'category' => 'footpath_damage', 'code' => 'BBMP_ENG', 'priority' => $medium, 'sla' => 1440, 'order' => 11],
                ['name' => 'Garbage -> BBMP SWM', 'category' => 'garbage', 'code' => 'BBMP_SWM', 'priority' => $medium, 'sla' => 1440, 'order' => 12],
                ['name' => 'Dead Animal -> BBMP SWM', 'category' => 'dead_animal', 'code' => 'BBMP_SWM', 'priority' => $medium, 'sla' => 1440, 'order' => 13],
                ['name' => 'Streetlight -> BBMP Electrical', 'category' => 'streetlight', 'code' => 'BBMP_ELEC', 'priority' => $medium, 'sla' => 1440, 'order' => 14],
                ['name' => 'Power Outage -> BESCOM', 'category' => 'power_outage', 'code' => 'BESCOM', 'priority' => $high, 'sla' => 720, 'order' => 15],
                ['name' => 'Water Leak -> BWSSB', 'category' => 'water_leakage', 'code' => 'BWSSB', 'priority' => $high, 'sla' => 720, 'order' => 16],
                ['name' => 'Sewage Overflow -> BWSSB', 'category' => 'sewage_overflow', 'code' => 'BWSSB', 'priority' => $high, 'sla' => 720, 'order' => 17],
                ['name' => 'Drain Blockage -> BBMP SWD', 'category' => 'drain_blockage', 'code' => 'BBMP_SWD', 'priority' => $medium, 'sla' => 1440, 'order' => 18],
                ['name' => 'Traffic Violation -> BTP', 'category' => 'traffic_violation', 'code' => 'BTP', 'priority' => $high, 'sla' => 480, 'order' => 19],
                ['name' => 'Illegal Parking -> BTP', 'category' => 'illegal_parking', 'code' => 'BTP', 'priority' => $high, 'sla' => 480, 'order' => 20],
                ['name' => 'Tree Fall -> BBMP Forest', 'category' => 'tree_fall', 'code' => 'BBMP_FOR', 'priority' => $high, 'sla' => 720, 'order' => 21],
                ['name' => 'Stray Animal -> BBMP Animal Husbandry', 'category' => 'stray_animal', 'code' => 'BBMP_AH', 'priority' => $medium, 'sla' => 1440, 'order' => 22],
                ['name' => 'Encroachment -> BBMP Town Planning', 'category' => 'encroachment', 'code' => 'BBMP_TP', 'priority' => $medium, 'sla' => 2880, 'order' => 23],
                ['name' => 'Noise Pollution -> KSPCB', 'category' => 'noise_pollution', 'code' => 'KSPCB', 'priority' => $medium, 'sla' => 2880, 'order' => 24],
            ];

            foreach ($rules as $rule) {
                $department = $departments->get($rule['code']);

                if ($department === null) {
                    continue;
                }

                $this->ensureRule(
                    name: $rule['name'],
                    priority: $rule['order'],
                    conditions: ['category_in' => [$rule['category']]],
                    destinationDepartment: $department,
                    defaultPriority: $rule['priority'],
                    defaultSlaMinutes: $rule['sla'],
                );
            }

            // Keep the historical demo rules as inactive records for
            // migration/test compatibility. They are not part of the active
            // Phase 1 taxonomy.
            $legacyNames = [
                'Garbage -> BBMP Ward 112',
                'Roads, Water & Electricity -> BBMP Ward 112',
                'Traffic & Parking -> BTP',
                'Dead Animal -> BBMP Ward 112',
                'Pothole -> BBMP Ward 112',
            ];

            RoutingRule::query()
                ->whereIn('name', $legacyNames)
                ->update(['active' => false]);

            // Remove duplicate category rules left by the taxonomy migration.
            // The canonical rules above are the single active source of truth;
            // legacy demo rules remain inactive, while migration-era duplicates
            // are deleted rather than retained as confusing dead records.
            $canonicalNames = array_column($rules, 'name');
            $approvedCategories = array_column($rules, 'category');

            RoutingRule::query()
                ->whereNotIn('name', array_merge($canonicalNames, $legacyNames))
                ->get()
                ->each(function (RoutingRule $rule) use ($approvedCategories): void {
                    $conditions = $rule->conditions;
                    $categories = is_array($conditions) ? ($conditions['category_in'] ?? []) : [];
                    $categories = is_array($categories)
                        ? array_values(array_filter($categories, 'is_string'))
                        : [];

                    if ($categories !== [] && array_intersect($categories, $approvedCategories) !== []) {
                        $rule->delete();
                    }
                });

            $fallback = $departments->get('BBMP_ENG');

            if ($fallback !== null) {
                AppConfig::query()->updateOrCreate(
                    ['key' => RoutingFallbackService::APP_CONFIG_KEY],
                    [
                        'value' => ['department_id' => $fallback->id],
                        'enabled' => true,
                        'rollout_percentage' => 100,
                        'cohort' => null,
                        'description' => 'Default destination for reports that do not match an active routing rule.',
                    ],
                );
            }
        });

        app(RoutingRepository::class)->invalidate();
    }

    /**
     * @param  array<string, mixed>  $conditions
     */
    private function ensureRule(
        string $name,
        int $priority,
        array $conditions,
        Department $destinationDepartment,
        ReportPriority $defaultPriority,
        int $defaultSlaMinutes,
    ): RoutingRule {
        return RoutingRule::query()->updateOrCreate(
            ['name' => $name],
            [
                'description' => 'Bangalore sample routing rule.',
                'priority' => $priority,
                'conditions' => $conditions,
                'destination_department_id' => $destinationDepartment->id,
                'default_officer_id' => null,
                'default_priority_id' => $defaultPriority->id,
                'default_sla_minutes' => $defaultSlaMinutes,
                'active' => true,
            ],
        );
    }
}
