<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * The baseline roles + permissions are seeded on every `db:seed`
     * run; they are idempotent (firstOrCreate + syncPermissions), so
     * re-running is safe and reflects the current canonical matrix.
     *
     * The geography tree (India → Karnataka → Bengaluru + sample
     * wards) is seeded after the country row so the dependent
     * state / district / city / zone / ward upserts can find their
     * parents. The four default departments (BBMP, BTP, BWSSB,
     * BESCOM) are seeded last because they need the geography
     * tree (their `jurisdiction` field matches on a geography
     * attribute). The 10 default feature flags are seeded after
     * the master data — every other module reads them on cold
     * start.
     */
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            CountriesSeeder::class,
            GeographySeeder::class,
            DepartmentsSeeder::class,
            AppConfigsSeeder::class,
        ]);
    }
}
