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
     * parents. Countries other than India are not seeded here —
     * the Super Admin Portal (M12) creates them on demand.
     */
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            CountriesSeeder::class,
            GeographySeeder::class,
        ]);
    }
}
