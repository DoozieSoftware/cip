<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Database\Seeder;

/**
 * Seeds the default report types for Bengaluru (BBMP) per docs/04 §7.
 *
 * The set is deliberately small and citizen-friendly — categories
 * are grouped the way citizens describe issues, and ordered by civic
 * priority (most common/urgent first):
 *
 *   1. Roads              (potholes, road damage)
 *   2. Water & Sewage     (leakages, open drains, sewer overflows)
 *   3. Electricity        (streetlights, power issues)
 *   4. Garbage & Dumping  (household + bulk/illegal dumping)
 *   5. Traffic Violation  (routed to BTP)
 *   6. Illegal Parking    (routed to BTP)
 *   7. Encroachment
 *   8. Dead Animal        (routed to BBMP SWM, rarer — listed last)
 *
 * Legacy codes that were merged into the new set (pothole,
 * road_damage, water_leakage, streetlight, open_drain,
 * illegal_dumping) are explicitly deactivated so new submissions only
 * see the active set while existing reports keep their history.
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
        ['name' => 'Roads', 'code' => 'roads', 'icon' => 'road', 'color' => '#3F51B5', 'sort_order' => 1],
        ['name' => 'Water & Sewage', 'code' => 'water_sewage', 'icon' => 'droplet', 'color' => '#03A9F4', 'sort_order' => 2],
        ['name' => 'Electricity', 'code' => 'electricity', 'icon' => 'bulb', 'color' => '#FFC107', 'sort_order' => 3],
        ['name' => 'Garbage & Dumping', 'code' => 'garbage', 'icon' => 'trash', 'color' => '#795548', 'sort_order' => 4],
        ['name' => 'Traffic Violation', 'code' => 'traffic_violation', 'icon' => 'traffic', 'color' => '#D32F2F', 'sort_order' => 5],
        ['name' => 'Illegal Parking', 'code' => 'illegal_parking', 'icon' => 'parking', 'color' => '#FF5722', 'sort_order' => 6],
        ['name' => 'Encroachment', 'code' => 'encroachment', 'icon' => 'fence', 'color' => '#6A1B9A', 'sort_order' => 7],
        ['name' => 'Dead Animal', 'code' => 'dead_animal', 'icon' => 'alert', 'color' => '#212121', 'sort_order' => 8],
    ];

    /**
     * Codes that were merged into the active set. Deactivated (not
     * deleted) so existing reports keep their history.
     *
     * @var list<string>
     */
    private const DEPRECATED_CODES = [
        'pothole', 'road_damage', 'water_leakage', 'streetlight',
        'open_drain', 'illegal_dumping',
    ];

    public function run(): void
    {
        foreach (self::TYPES as $row) {
            ReportType::query()->updateOrCreate(
                ['code' => $row['code']],
                [
                    'name' => $row['name'],
                    'description' => 'Default seeded report type for '.$row['name'].'.',
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
