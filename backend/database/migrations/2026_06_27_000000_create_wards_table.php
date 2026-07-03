<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Master `wards` table per docs/04 §8 (Location Domain).
 *
 * V1 geography terminates at the ward level. Wards carry:
 *  - id          : UUID primary key
 *  - city_id     : UUID FK → cities.id
 *  - zone_id     : UUID FK → zones.id (nullable; small cities have no zones)
 *  - ward_number : numeric within a city (e.g. 1, 2, 3)
 *  - name        : display name
 *  - municipality: parent municipal authority
 *  - boundary_polygon : MySQL POLYGON (with SPATIAL INDEX) on MySQL,
 *                       JSON on SQLite (test driver). The application
 *                       layer always reads / writes WKT (well-known
 *                       text) and the driver-specific column is an
 *                       implementation detail.
 *  - active      : soft-disable flag
 *  - timestamps, soft deletes
 *
 * Per docs/16 §36, the spatial index is a raw SQL statement so
 * SQLite (used in the test environment) does not reject the
 * migration. The application code is responsible for validating
 * the WKT and the spatial index is the database's job.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wards', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('city_id');
            $table->uuid('zone_id')->nullable();
            $table->unsignedInteger('ward_number');
            $table->string('name');
            $table->string('municipality')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('city_id')
                ->references('id')->on('cities')
                ->restrictOnDelete();
            $table->foreign('zone_id')
                ->references('id')->on('zones')
                ->nullOnDelete();
            $table->unique(['city_id', 'ward_number']);
            $table->index('active');
        });

        // Driver-specific column for the boundary polygon.
        // MySQL gets a real POLYGON + spatial index; SQLite gets
        // a TEXT column for WKT (no spatial index). The
        // application code uses WKT everywhere.
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            $versionRow = DB::selectOne('select version() as version');
            $version = $versionRow->version ?? '';
            $isMariaDb = stripos($version, 'mariadb') !== false;
            $isMysql57 = version_compare(preg_replace('/-[a-z0-9].*$/i', '', $version), '8.0', '<');

            $columnDefinition = ($isMariaDb || $isMysql57)
                ? 'POLYGON NOT NULL'
                : 'POLYGON NOT NULL SRID 4326';

            DB::statement("ALTER TABLE wards ADD COLUMN boundary_polygon {$columnDefinition}");
            DB::statement('ALTER TABLE wards ADD SPATIAL INDEX wards_boundary_polygon_sidx (boundary_polygon)');
        } else {
            Schema::table('wards', function (Blueprint $table): void {
                $table->text('boundary_polygon')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('wards');
    }
};
