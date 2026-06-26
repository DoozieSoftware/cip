<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Database\Seeder;

/**
 * Seeds the 10 default report types per docs/04 §7.
 *
 * Each row carries the platform-wide defaults:
 *  - `requires_video = true` (citizens must attach a video)
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
     * @var list<array<string, string>>
     */
    private const TYPES = [
        ['name' => 'Illegal Parking', 'code' => 'illegal_parking', 'icon' => 'parking', 'color' => '#FF5722'],
        ['name' => 'Garbage', 'code' => 'garbage', 'icon' => 'trash', 'color' => '#795548'],
        ['name' => 'Pothole', 'code' => 'pothole', 'icon' => 'road', 'color' => '#3F51B5'],
        ['name' => 'Streetlight', 'code' => 'streetlight', 'icon' => 'bulb', 'color' => '#FFC107'],
        ['name' => 'Water Leakage', 'code' => 'water_leakage', 'icon' => 'droplet', 'color' => '#03A9F4'],
        ['name' => 'Road Damage', 'code' => 'road_damage', 'icon' => 'road-block', 'color' => '#9E9E9E'],
        ['name' => 'Illegal Dumping', 'code' => 'illegal_dumping', 'icon' => 'dump', 'color' => '#4E342E'],
        ['name' => 'Encroachment', 'code' => 'encroachment', 'icon' => 'fence', 'color' => '#6A1B9A'],
        ['name' => 'Dead Animal', 'code' => 'dead_animal', 'icon' => 'alert', 'color' => '#212121'],
        ['name' => 'Open Drain', 'code' => 'open_drain', 'icon' => 'drain', 'color' => '#0097A7'],
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
                    'requires_video' => true,
                    'requires_photo' => true,
                    'min_photos' => 1,
                    'max_photos' => 5,
                    'active' => true,
                ],
            );
        }
    }
}
