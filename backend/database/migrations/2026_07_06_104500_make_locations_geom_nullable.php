<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $versionRow = DB::selectOne('select version() as version');
        $version = strtolower((string) ($versionRow->version ?? ''));
        $isMariaDb = str_contains($version, 'mariadb');
        $normalizedVersion = preg_replace('/-[a-z0-9].*$/i', '', $version) ?: $version;
        $supportsSrid = ! $isMariaDb && version_compare($normalizedVersion, '8.0', '>=');

        $geomExpression = $supportsSrid
            ? 'ST_SRID(POINT(NEW.longitude, NEW.latitude), 4326)'
            : 'POINT(NEW.longitude, NEW.latitude)';

        DB::unprepared('DROP TRIGGER IF EXISTS locations_before_insert_geom');
        DB::unprepared('DROP TRIGGER IF EXISTS locations_before_update_geom');

        // Triggers require SUPER privilege to create (binary logging is
        // enabled). On constrained hosting this fails, but the
        // application layer (Location model `creating` event) already
        // populates `geom`, so the trigger is only a belt-and-braces
        // safety net. Swallow the error so the migration completes and
        // does not block later migrations.
        try {
            DB::unprepared("
                CREATE TRIGGER locations_before_insert_geom
                BEFORE INSERT ON locations
                FOR EACH ROW
                SET NEW.geom = {$geomExpression}
            ");

            DB::unprepared("
                CREATE TRIGGER locations_before_update_geom
                BEFORE UPDATE ON locations
                FOR EACH ROW
                SET NEW.geom = {$geomExpression}
            ");
        } catch (Throwable $e) {
            // No SUPER privilege — rely on the app-layer geom sync.
            report($e);
        }

        $backfillExpression = $supportsSrid
            ? 'ST_SRID(POINT(longitude, latitude), 4326)'
            : 'POINT(longitude, latitude)';

        DB::statement("UPDATE locations SET geom = {$backfillExpression}");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::unprepared('DROP TRIGGER IF EXISTS locations_before_insert_geom');
        DB::unprepared('DROP TRIGGER IF EXISTS locations_before_update_geom');
    }
};
