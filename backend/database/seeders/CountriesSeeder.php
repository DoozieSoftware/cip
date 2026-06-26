<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Departments\Models\Country;
use Illuminate\Database\Seeder;

/**
 * Master data: ISO 3166 countries. The seeder is idempotent —
 * `firstOrCreate` on the unique `iso2` index lets it be re-run
 * without duplicating rows.
 *
 * Per docs/04 §8 the geography master is DB-driven (never
 * hardcoded in source) so the V1 set is the minimum that the
 * Citizen PWA + Routing engine need. Additional countries are
 * added via the Super Admin Portal (M12) using the same
 * firstOrCreate upsert.
 */
class CountriesSeeder extends Seeder
{
    /**
     * @var list<array<string, string>>
     */
    private const COUNTRIES = [
        ['name' => 'India', 'iso2' => 'IN', 'iso3' => 'IND', 'phone_code' => '+91'],
        ['name' => 'United States', 'iso2' => 'US', 'iso3' => 'USA', 'phone_code' => '+1'],
        ['name' => 'United Kingdom', 'iso2' => 'GB', 'iso3' => 'GBR', 'phone_code' => '+44'],
        ['name' => 'United Arab Emirates', 'iso2' => 'AE', 'iso3' => 'ARE', 'phone_code' => '+971'],
        ['name' => 'Singapore', 'iso2' => 'SG', 'iso3' => 'SGP', 'phone_code' => '+65'],
    ];

    public function run(): void
    {
        foreach (self::COUNTRIES as $row) {
            Country::query()->firstOrCreate(
                ['iso2' => $row['iso2']],
                [
                    'name' => $row['name'],
                    'iso3' => $row['iso3'],
                    'phone_code' => $row['phone_code'],
                    'active' => true,
                ],
            );
        }
    }
}
