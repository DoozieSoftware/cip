<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Departments\Models\City;
use App\Modules\Departments\Models\Country;
use App\Modules\Departments\Models\District;
use App\Modules\Departments\Models\State;
use App\Modules\Departments\Models\Ward;
use App\Modules\Departments\Models\Zone;
use Illuminate\Database\Seeder;

/**
 * Master data: India → Karnataka → Bangalore Urban + Rural
 * districts → sample zones → sample wards.
 *
 * Per docs/04 §8 the geography master is DB-driven. The
 * seeder is idempotent: every level uses a deterministic
 * natural key (`iso2`, `(state_id, code)`, `(district_id, code)`,
 * `(city_id, code)`, `(city_id, ward_number)`) and
 * `updateOrCreate` so re-running the seeder is a no-op.
 *
 * The data set is the minimum the Routing engine (M7) and the
 * Citizen PWA (M13) need to start issuing reports. Additional
 * states / districts / cities are added via the Super Admin
 * Portal (M12) using the same upsert path.
 */
class GeographySeeder extends Seeder
{
    public function run(): void
    {
        $india = Country::query()->updateOrCreate(
            ['iso2' => 'IN'],
            [
                'name' => 'India',
                'iso3' => 'IND',
                'phone_code' => '+91',
                'active' => true,
            ],
        );

        $karnataka = State::query()->updateOrCreate(
            ['country_id' => $india->id, 'code' => 'KA'],
            [
                'name' => 'Karnataka',
                'active' => true,
            ],
        );

        $bangaloreUrban = District::query()->updateOrCreate(
            ['state_id' => $karnataka->id, 'code' => 'KA-BU'],
            [
                'name' => 'Bangalore Urban',
                'active' => true,
            ],
        );

        $bangaloreRural = District::query()->updateOrCreate(
            ['state_id' => $karnataka->id, 'code' => 'KA-BR'],
            [
                'name' => 'Bangalore Rural',
                'active' => true,
            ],
        );

        $bengaluruCity = City::query()->updateOrCreate(
            ['district_id' => $bangaloreUrban->id, 'code' => 'BLR-CITY'],
            [
                'name' => 'Bengaluru',
                'active' => true,
            ],
        );

        $bengaluruEast = Zone::query()->updateOrCreate(
            ['city_id' => $bengaluruCity->id, 'code' => 'BLR-EAST'],
            [
                'name' => 'East Zone',
                'active' => true,
            ],
        );

        $bengaluruWest = Zone::query()->updateOrCreate(
            ['city_id' => $bengaluruCity->id, 'code' => 'BLR-WEST'],
            [
                'name' => 'West Zone',
                'active' => true,
            ],
        );

        $bengaluruSouth = Zone::query()->updateOrCreate(
            ['city_id' => $bengaluruCity->id, 'code' => 'BLR-SOUTH'],
            [
                'name' => 'South Zone',
                'active' => true,
            ],
        );

        $doddaballapur = City::query()->updateOrCreate(
            ['district_id' => $bangaloreRural->id, 'code' => 'DDP'],
            [
                'name' => 'Doddaballapur',
                'active' => true,
            ],
        );

        // Sample wards — 6 around Bengaluru, 2 in Doddaballapur.
        // Each ward carries a tiny WKT square as a placeholder
        // boundary polygon (real boundary data is loaded later
        // from the BBMP / district GIS export).
        $wards = [
            [$bengaluruCity->id, $bengaluruEast->id, 1, 'Jeevan Bima Nagar', 'BBMP'],
            [$bengaluruCity->id, $bengaluruEast->id, 2, 'CV Raman Nagar', 'BBMP'],
            [$bengaluruCity->id, $bengaluruWest->id, 50, 'Rajajinagar', 'BBMP'],
            [$bengaluruCity->id, $bengaluruWest->id, 51, 'Prakash Nagar', 'BBMP'],
            [$bengaluruCity->id, $bengaluruSouth->id, 175, 'HSR Layout', 'BBMP'],
            [$bengaluruCity->id, $bengaluruSouth->id, 176, 'Bommanahalli', 'BBMP'],
            [$doddaballapur->id, null, 1, 'Doddaballapur Town', 'TMC'],
            [$doddaballapur->id, null, 2, 'Doddaballapur Rural', 'TMC'],
        ];

        foreach ($wards as [$cityId, $zoneId, $wardNumber, $name, $municipality]) {
            Ward::query()->updateOrCreate(
                ['city_id' => $cityId, 'ward_number' => $wardNumber],
                [
                    'zone_id' => $zoneId,
                    'name' => $name,
                    'municipality' => $municipality,
                    'active' => true,
                    'boundary_polygon' => $this->placeholderPolygon($cityId, $wardNumber),
                ],
            );
        }
    }

    /**
     * A tiny WKT square around a synthetic centroid. Real
     * boundary data is loaded later from the BBMP / district
     * GIS export — the seeder just needs a non-null polygon
     * so the spatial-index path is exercised end-to-end.
     */
    private function placeholderPolygon(string $cityId, int $wardNumber): string
    {
        // Deterministic offset per ward so adjacent wards do
        // not share a polygon.
        $lat = 12.97 + ($wardNumber * 0.001);
        $lng = 77.59 + ($wardNumber * 0.001);
        $d = 0.005;

        return sprintf(
            'POLYGON((%F %F,%F %F,%F %F,%F %F,%F %F))',
            $lng - $d, $lat - $d,
            $lng + $d, $lat - $d,
            $lng + $d, $lat + $d,
            $lng - $d, $lat + $d,
            $lng - $d, $lat - $d,
        );
    }
}
