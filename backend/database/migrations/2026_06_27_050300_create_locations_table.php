<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `locations` table per docs/04 §8 and §24.
 *
 * The application always reads/writes `latitude` and `longitude` as
 * decimals; the `geom` POINT column is an internal MySQL spatial
 * index, mirrored from the lat/lng via raw SQL.
 *
 * Per docs/16 §36 the spatial column is created with `DB::statement`
 * so the SQLite (test) driver is not asked to create a `POINT`
 * column. The application layer never touches `geom` directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('locations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('altitude', 8, 2)->nullable();
            $table->decimal('accuracy', 8, 2)->nullable();
            $table->decimal('heading', 5, 2)->nullable();
            $table->decimal('speed', 6, 2)->nullable();
            $table->string('gps_provider', 32)->nullable();
            $table->timestamp('captured_at')->nullable();
            $table->string('address')->nullable();
            $table->uuid('ward_id')->nullable();
            $table->uuid('district_id')->nullable();
            $table->timestamps();

            $table->foreign('ward_id')
                ->references('id')->on('wards')
                ->nullOnDelete();
            $table->foreign('district_id')
                ->references('id')->on('districts')
                ->nullOnDelete();
            $table->index(['ward_id']);
            $table->index(['district_id']);
        });

        // MySQL-only: create the POINT column + spatial index.
        // SQLite (test driver) ignores this branch.
        if (DB::getDriverName() === 'mysql') {
            $version = DB::selectOne('select version() as version')->version ?? '';
            $isMariaDb = stripos($version, 'mariadb') !== false;
            $columnDefinition = $isMariaDb ? 'POINT NOT NULL' : 'POINT';

            DB::statement("ALTER TABLE locations ADD geom {$columnDefinition} AFTER longitude");
            DB::statement('CREATE SPATIAL INDEX idx_locations_geom ON locations (geom)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};
