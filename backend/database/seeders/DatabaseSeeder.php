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
     */
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            CountriesSeeder::class,
        ]);
    }
}
