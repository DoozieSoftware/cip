<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Multi-centre support per zone (issue #11).
 *
 * Each service zone previously held exactly one drop-off centre via the
 * legacy dropoff_name/dropoff_address columns. Zones now hold many centres
 * in textile_dropoff_centres; the legacy columns stay untouched for
 * back-compat. Collection requests may reference the chosen centre via
 * textile_collection_requests.dropoff_centre_id.
 *
 * Backfill is FirstOrCreate-style: zones with legacy centre details get one
 * centre row only when the zone has none, so reruns never overwrite
 * partner-tuned centre rows. No seed data is created.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('textile_dropoff_centres', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('service_zone_id');
            $table->string('name', 255);
            $table->text('address')->nullable();
            $table->json('operating_hours')->nullable();
            $table->string('public_phone', 32)->nullable();
            $table->string('status', 32)->default('open');
            $table->text('closed_note')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('service_zone_id')->references('id')->on('textile_service_zones')->restrictOnDelete();
            $table->index('service_zone_id');
            $table->index(['service_zone_id', 'active'], 'tdc_zone_active_idx');
        });

        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->uuid('dropoff_centre_id')->nullable()->after('service_zone_id');
            $table->foreign('dropoff_centre_id')->references('id')->on('textile_dropoff_centres')->nullOnDelete();
            $table->index('dropoff_centre_id', 'tcr_dropoff_centre_idx');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engineConfig = DB::getConfig('connections.mysql.engine');
            $charsetConfig = DB::getConfig('connections.mysql.charset');
            $collationConfig = DB::getConfig('connections.mysql.collation');
            $engine = is_string($engineConfig) && $engineConfig !== '' ? $engineConfig : 'InnoDB';
            $charset = is_string($charsetConfig) && $charsetConfig !== '' ? $charsetConfig : 'utf8mb4';
            $collation = is_string($collationConfig) && $collationConfig !== '' ? $collationConfig : 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE textile_dropoff_centres ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }

        // FirstOrCreate-style backfill: one centre per legacy zone, only when
        // the zone has no centres yet. Existing rows are never updated.
        // (Zone counts are small; a plain get() keeps this portable across
        // MySQL and SQLite without chunkById UUID-key pitfalls.)
        $zones = DB::table('textile_service_zones')
            ->whereNotNull('dropoff_name')
            ->orWhereNotNull('dropoff_address')
            ->orderBy('name')
            ->get();

        foreach ($zones as $zone) {
            $name = is_string($zone->dropoff_name) ? trim($zone->dropoff_name) : '';
            $address = is_string($zone->dropoff_address) ? trim($zone->dropoff_address) : '';
            $zoneName = is_string($zone->name) ? $zone->name : '';

            if ($name === '' && $address === '') {
                continue;
            }

            $exists = DB::table('textile_dropoff_centres')
                ->where('service_zone_id', $zone->id)
                ->exists();

            if ($exists) {
                continue;
            }

            $status = is_string($zone->centre_status) && $zone->centre_status !== ''
                ? $zone->centre_status
                : 'open';

            DB::table('textile_dropoff_centres')->insert([
                'id' => (string) Str::uuid(),
                'service_zone_id' => $zone->id,
                'name' => $name !== '' ? $name : ('Zone centre — '.$zoneName),
                'address' => $address !== '' ? $address : null,
                'operating_hours' => $zone->operating_hours ?? null,
                'public_phone' => $zone->public_phone ?? null,
                'status' => $status,
                'closed_note' => $zone->centre_closed_note ?? null,
                'active' => true,
                'sort_order' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->dropForeign(['dropoff_centre_id']);
            $table->dropIndex('tcr_dropoff_centre_idx');
            $table->dropColumn('dropoff_centre_id');
        });

        Schema::dropIfExists('textile_dropoff_centres');
    }
};
