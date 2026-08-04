<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Database\Seeder;

/**
 * Seeds the approved Phase 1 report categories for Bengaluru per
 * docs/department-routing-mapping.md §4 — 15 fine-grained codes that map
 * 1:1 to the responsible department (BBMP wing or external agency):
 *
 *   pothole/footpath_damage -> BBMP Roads      streetlight -> BBMP Electrical
 *   garbage/dead_animal     -> BBMP SWM        power_outage -> BESCOM
 *   water_leakage/sewage_overflow -> BWSSB     drain_blockage -> BBMP SWD
 *   traffic_violation/illegal_parking -> BTP   tree_fall -> BBMP Forest
 *   stray_animal -> BBMP Animal Husbandry      encroachment -> BBMP Town Planning
 *   noise_pollution -> KSPCB
 *
 * Superseded broad codes (roads, water_sewage, electricity) are
 * deactivated — historical reports keep their codes.
 *
 * Each row carries the platform-wide defaults:
 *  - `requires_video = false` (video is optional by default)
 *  - `requires_photo = true` (citizens must attach a photo)
 *  - `min_photos = 1`, `max_photos = 5`
 *
 * The `department_default_id` is intentionally null at seed time
 * — the Routing engine (M7) populates it via routing rules so a
 * type can be re-routed without a schema change.
 *
 * Idempotent: `updateOrCreate` on `code`.
 */
class ReportTypesSeeder extends Seeder
{
    /**
     * @var list<array<string, int|string>>
     */
    private const TYPES = [
        ['name' => 'Road Pothole / Damage', 'code' => 'pothole', 'icon' => 'road', 'color' => '#3F51B5', 'sort_order' => 1],
        ['name' => 'Damaged Footpath', 'code' => 'footpath_damage', 'icon' => 'walk', 'color' => '#455A64', 'sort_order' => 2],
        ['name' => 'Uncollected / Open Garbage', 'code' => 'garbage', 'icon' => 'trash', 'color' => '#795548', 'sort_order' => 3],
        ['name' => 'Dead Animal Disposal', 'code' => 'dead_animal', 'icon' => 'alert', 'color' => '#212121', 'sort_order' => 4],
        ['name' => 'Non-Functional Streetlight', 'code' => 'streetlight', 'icon' => 'bulb', 'color' => '#FFC107', 'sort_order' => 5],
        ['name' => 'Power Outage / Transformer', 'code' => 'power_outage', 'icon' => 'zap', 'color' => '#F4511E', 'sort_order' => 6],
        ['name' => 'Water Pipeline Burst / Leak', 'code' => 'water_leakage', 'icon' => 'droplet', 'color' => '#03A9F4', 'sort_order' => 7],
        ['name' => 'Sewage Overflow / Manhole', 'code' => 'sewage_overflow', 'icon' => 'droplet', 'color' => '#01579B', 'sort_order' => 8],
        ['name' => 'Storm Water Drain Blockage', 'code' => 'drain_blockage', 'icon' => 'droplet', 'color' => '#00838F', 'sort_order' => 9],
        ['name' => 'Traffic Violation / Congestion', 'code' => 'traffic_violation', 'icon' => 'traffic', 'color' => '#D32F2F', 'sort_order' => 10],
        ['name' => 'Illegal / Footpath Parking', 'code' => 'illegal_parking', 'icon' => 'parking', 'color' => '#FF5722', 'sort_order' => 11],
        ['name' => 'Fallen Tree / Overhanging Branch', 'code' => 'tree_fall', 'icon' => 'tree', 'color' => '#2E7D32', 'sort_order' => 12],
        ['name' => 'Stray Dog / Animal Menace', 'code' => 'stray_animal', 'icon' => 'alert', 'color' => '#6D4C41', 'sort_order' => 13],
        ['name' => 'Public Property Encroachment', 'code' => 'encroachment', 'icon' => 'fence', 'color' => '#6A1B9A', 'sort_order' => 14],
        ['name' => 'Industrial / Commercial Noise', 'code' => 'noise_pollution', 'icon' => 'volume', 'color' => '#5C6BC0', 'sort_order' => 15],
    ];

    /**
     * Codes superseded by the approved taxonomy. Deactivated (not
     * deleted) so existing reports keep their history.
     *
     * @var list<string>
     */
    private const DEPRECATED_CODES = [
        'roads', 'water_sewage', 'electricity', 'road_damage',
        'open_drain', 'illegal_dumping',
    ];

    public function run(): void
    {
        foreach (self::TYPES as $row) {
            ReportType::query()->updateOrCreate(
                ['code' => $row['code']],
                [
                    'name' => $row['name'],
                    'description' => 'Approved Bengaluru routing category for '.$row['name'].'.',
                    'icon' => $row['icon'],
                    'color' => $row['color'],
                    'sort_order' => $row['sort_order'],
                    'requires_video' => false,
                    'requires_photo' => true,
                    'min_photos' => 1,
                    'max_photos' => 5,
                    'active' => true,
                ],
            );
        }

        ReportType::query()
            ->whereIn('code', self::DEPRECATED_CODES)
            ->update(['active' => false, 'sort_order' => 0]);
    }
}
