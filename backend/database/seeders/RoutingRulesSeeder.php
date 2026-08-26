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
 *   - internal AI-label rules run before broad citizen-category fallbacks
 *   - broad citizen categories remain the only PWA choices
 *   - clothes_waste is handled by the standalone Dr. Linen module;
 *     metal and e-waste remain BBMP SWM complaint routes
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

            // Internal AI labels are more specific than the broad citizen
            // categories, so they run first. Broad category rules below are
            // safe fallbacks when no internal label is available.
            $rules = [
                ['name' => 'Tree Fall -> BBMP Forest', 'conditions' => ['ai_label_in' => ['tree_fall']], 'code' => 'BBMP_FOR', 'priority' => $high, 'sla' => 720, 'order' => 10],
                ['name' => 'Stray Animal -> BBMP Animal Husbandry', 'conditions' => ['ai_label_in' => ['stray_animal']], 'code' => 'BBMP_AH', 'priority' => $medium, 'sla' => 1440, 'order' => 11],
                ['name' => 'Streetlight -> BBMP Electrical', 'conditions' => ['ai_label_in' => ['streetlight']], 'code' => 'BBMP_ELEC', 'priority' => $medium, 'sla' => 1440, 'order' => 12],
                ['name' => 'Power Outage -> BESCOM', 'conditions' => ['ai_label_in' => ['power_outage']], 'code' => 'BESCOM', 'priority' => $high, 'sla' => 720, 'order' => 13],
                ['name' => 'Water Leak -> BWSSB', 'conditions' => ['ai_label_in' => ['water_leakage']], 'code' => 'BWSSB', 'priority' => $high, 'sla' => 720, 'order' => 14],
                ['name' => 'Sewage Overflow -> BWSSB', 'conditions' => ['ai_label_in' => ['sewage_overflow']], 'code' => 'BWSSB', 'priority' => $high, 'sla' => 720, 'order' => 15],
                ['name' => 'Drain Blockage -> BBMP SWD', 'conditions' => ['ai_label_in' => ['drain_blockage']], 'code' => 'BBMP_SWD', 'priority' => $medium, 'sla' => 1440, 'order' => 16],
                ['name' => 'Noise Pollution -> KSPCB', 'conditions' => ['ai_label_in' => ['noise_pollution']], 'code' => 'KSPCB', 'priority' => $medium, 'sla' => 2880, 'order' => 17],
                ['name' => 'Road Detail -> BBMP Roads', 'conditions' => ['ai_label_in' => ['pothole', 'footpath_damage', 'road_damage']], 'code' => 'BBMP_ENG', 'priority' => $medium, 'sla' => 1440, 'order' => 18],
                ['name' => 'Roads -> BBMP Roads', 'conditions' => ['category_in' => ['roads']], 'code' => 'BBMP_ENG', 'priority' => $medium, 'sla' => 1440, 'order' => 20],
                ['name' => 'Water & Sewage -> BWSSB', 'conditions' => ['category_in' => ['water_sewage']], 'code' => 'BWSSB', 'priority' => $high, 'sla' => 720, 'order' => 21],
                ['name' => 'Electricity -> BESCOM', 'conditions' => ['category_in' => ['electricity']], 'code' => 'BESCOM', 'priority' => $high, 'sla' => 720, 'order' => 22],
                ['name' => 'Garbage & Dead Animal -> BBMP SWM', 'conditions' => ['category_in' => ['garbage', 'dead_animal']], 'code' => 'BBMP_SWM', 'priority' => $medium, 'sla' => 1440, 'order' => 23],
                ['name' => 'Traffic & Parking -> BTP', 'conditions' => ['category_in' => ['traffic_violation', 'illegal_parking']], 'code' => 'BTP', 'priority' => $high, 'sla' => 480, 'order' => 24],
                ['name' => 'Encroachment -> BBMP Town Planning', 'conditions' => ['category_in' => ['encroachment']], 'code' => 'BBMP_TP', 'priority' => $medium, 'sla' => 2880, 'order' => 25],
                ['name' => 'Metal Scrap & E-Waste -> BBMP SWM', 'conditions' => ['category_in' => ['metal_scrap', 'e_waste']], 'code' => 'BBMP_SWM', 'priority' => $medium, 'sla' => 1440, 'order' => 26],
            ];

            foreach ($rules as $rule) {
                $department = $departments->get($rule['code']);

                if ($department === null) {
                    continue;
                }

                $this->ensureRule(
                    name: $rule['name'],
                    priority: $rule['order'],
                    conditions: $rule['conditions'],
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
                'Dead Animal -> BBMP Ward 112',
                'Pothole -> BBMP Ward 112',
                'Pothole -> BBMP Roads',
                'Footpath -> BBMP Roads',
                'Garbage -> BBMP SWM',
                'Dead Animal -> BBMP SWM',
                'Traffic Violation -> BTP',
                'Illegal Parking -> BTP',
                'Clothes, Metal Scrap & E-Waste -> BBMP SWM',
                'Clothes & Textiles -> Dr. Linen',
            ];

            RoutingRule::query()
                ->whereIn('name', $legacyNames)
                ->update(['active' => false]);

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
