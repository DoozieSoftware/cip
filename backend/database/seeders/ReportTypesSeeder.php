<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Database\Seeder;

/**
 * Seeds the citizen-facing report categories for Bengaluru: the eight
 * broad original categories plus the three waste-stream categories
 * (product defaults D10–D15). Categories remain broad and
 * citizen-friendly; department routing happens after submission and is
 * not exposed as extra issue types in the PWA.
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
 * The waste-stream rows additionally carry Kannada localizations and
 * citizen search aliases; they mirror migration
 * 2026_08_21_020000_add_waste_stream_categories so production
 * (`migrate --force` only) and fresh installs converge.
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
     * Waste-stream categories (D10–D15). These rows additionally carry
     * Kannada localizations (`localizations`) and citizen search terms
     * (`aliases`).
     *
     * All three are collection streams handled by the Dr. Linen partner
     * service at /citizen -> "Request pickup", not complaint categories, so
     * they are deactivated (kept for historical reports) to keep a single
     * entry point. Illegal dumping of these materials remains reportable
     * under "Garbage & Dumping", which still routes to BBMP SWM.
     *
     * @var list<array<string, mixed>>
     */
    private const WASTE_STREAM_TYPES = [
        [
            'name' => 'Clothes & Textiles',
            'code' => 'clothes_waste',
            'icon' => 'hanger',
            'color' => '#00897B',
            'sort_order' => 9,
            'requires_photo' => false,
            'min_photos' => 0,
            'active' => false,
            'localizations' => ['kn-IN' => 'ಬಟ್ಟೆಗಳು ಮತ್ತು ಜವಳಿ'],
            'aliases' => ['old clothes', 'clothes donation', 'textiles', 'ಬಟ್ಟೆ'],
        ],
        [
            'name' => 'Metal Scrap',
            'code' => 'metal_scrap',
            'icon' => 'scrap',
            'color' => '#607D8B',
            'sort_order' => 10,
            'active' => false,
            'localizations' => ['kn-IN' => 'ಲೋಹದ ಸ್ಕ್ರ್ಯಾಪ್'],
            'aliases' => ['scrap metal', 'loha', 'ಸ್ಕ್ರ್ಯಾಪ್'],
        ],
        [
            'name' => 'Electronic Waste (E-Waste)',
            'code' => 'e_waste',
            'icon' => 'device',
            'color' => '#C62828',
            'sort_order' => 11,
            'active' => false,
            'localizations' => ['kn-IN' => 'ಎಲೆಕ್ಟ್ರಾನಿಕ್ ತ್ಯಾಜ್ಯ (ಇ-ವೇಸ್ಟ್)'],
            'aliases' => ['e-waste', 'ewaste', 'electronics', 'computer'],
        ],
    ];

    /**
     * Codes superseded by the approved taxonomy. Deactivated (not
     * deleted) so existing reports keep their history.
     *
     * @var list<string>
     */
    private const DEPRECATED_CODES = [
        'pothole', 'footpath_damage', 'road_damage', 'streetlight',
        'power_outage', 'water_leakage', 'sewage_overflow', 'drain_blockage',
        'tree_fall', 'stray_animal', 'noise_pollution',
    ];

    public function run(): void
    {
        foreach ([...self::TYPES, ...self::WASTE_STREAM_TYPES] as $row) {
            $attributes = [
                'name' => $row['name'],
                'description' => 'Default seeded report type for '.$row['name'].'.',
                'icon' => $row['icon'],
                'color' => $row['color'],
                'sort_order' => $row['sort_order'],
                'requires_video' => false,
                'requires_photo' => true,
                'min_photos' => 1,
                'max_photos' => 5,
                'response_target_minutes' => 2880,
                'active' => true,
            ];

            if (array_key_exists('localizations', $row)) {
                $attributes['localizations'] = $row['localizations'];
            }

            if (array_key_exists('aliases', $row)) {
                $attributes['aliases'] = $row['aliases'];
            }

            if (array_key_exists('requires_photo', $row)) {
                $attributes['requires_photo'] = $row['requires_photo'];
            }

            if (array_key_exists('min_photos', $row)) {
                $attributes['min_photos'] = $row['min_photos'];
            }

            if (array_key_exists('active', $row)) {
                $attributes['active'] = $row['active'];
            }

            ReportType::query()->updateOrCreate(
                ['code' => $row['code']],
                $attributes,
            );
        }

        ReportType::query()
            ->whereIn('code', self::DEPRECATED_CODES)
            ->update(['active' => false, 'sort_order' => 0]);
    }
}
