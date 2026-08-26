<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Departments\Models\Department;
use App\Modules\TextileCollections\Models\TextilePartnerCapability;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use Illuminate\Database\Seeder;

final class TextileCollectionsSeeder extends Seeder
{
    public function run(): void
    {
        // ── 1. Resolve DR_LINEN department ──────────────────────────
        $drLinen = Department::query()->where('code', 'DR_LINEN')->first();

        if ($drLinen === null) {
            // Department not yet seeded; skip zone creation.
            return;
        }

        // ── 2. Ensure DR_LINEN has clothes_waste capability ─────────
        TextilePartnerCapability::query()->updateOrCreate(
            ['department_id' => $drLinen->id, 'category' => 'clothes_waste'],
        );

        // ── 3. Create/upgrade DEMO second partner for testing ────────
        $demoDept = Department::query()->where('code', 'DEMO_EWASTE')->first();

        if ($demoDept === null) {
            $demoDept = Department::query()->create([
                'name' => 'Demo E-Waste Recyclers (Demo)',
                'code' => 'DEMO_EWASTE',
                'active' => true,
                'default_sla_minutes' => 4320,
            ]);
        }

        // DEMO partner collects metal_scrap + e_waste.
        foreach (['metal_scrap', 'e_waste'] as $cat) {
            TextilePartnerCapability::query()->updateOrCreate(
                ['department_id' => $demoDept->id, 'category' => $cat],
            );
        }

        // ── 4. Local/demo service areas ─────────────────────────────
        // Local/demo service areas only. Production zones are operational
        // configuration and are not invented by this seeder.
        foreach ([
            ['code' => 'DRL-KENGERI', 'name' => 'Kengeri', 'lat' => 12.9141, 'lng' => 77.4820],
            ['code' => 'DRL-JAYANAGAR', 'name' => 'Jayanagar', 'lat' => 12.9250, 'lng' => 77.5938],
            ['code' => 'DRL-WHITEFIELD', 'name' => 'Whitefield', 'lat' => 12.9698, 'lng' => 77.7500],
        ] as $zone) {
            TextileServiceZone::query()->updateOrCreate(
                ['code' => $zone['code']],
                [
                    'name' => $zone['name'],
                    'department_id' => $drLinen->id,
                    'center_latitude' => $zone['lat'],
                    'center_longitude' => $zone['lng'],
                    'service_radius_km' => 12,
                    'dropoff_enabled' => true,
                    'premises_pickup_enabled' => true,
                    'dropoff_name' => 'Dr. Linen '.$zone['name'].' collection point',
                    'dropoff_address' => 'Demo collection point — configure the verified address before production use.',
                    'readiness_instructions' => 'Keep textiles dry and packed in bags. Separate wet or hazardous waste.',
                    'active' => true,
                ],
            );
        }

        // ── 5. DEMO partner zone (fixture for multi-partner testing) ─
        // This is a demo fixture for multi-partner testing, not production config.
        TextileServiceZone::query()->updateOrCreate(
            ['code' => 'DEMO-EW-1'],
            [
                'name' => 'Demo E-Waste Zone',
                'department_id' => $demoDept->id,
                'center_latitude' => 12.9716,
                'center_longitude' => 77.5946,
                'service_radius_km' => 10,
                'dropoff_enabled' => true,
                'premises_pickup_enabled' => true,
                'dropoff_name' => 'Demo E-Waste drop point',
                'dropoff_address' => 'Demo collection point — not for production use.',
                'readiness_instructions' => 'Separate metals from e-waste. Do not mix with household waste.',
                'active' => true,
            ],
        );
    }
}
