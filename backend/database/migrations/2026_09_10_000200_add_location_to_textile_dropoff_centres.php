<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Centre map pins (follow-up to issue #11).
 *
 * Drop-off centres previously held only a text address, so staff could not
 * point the centre on a map. Adds nullable latitude/longitude; existing rows
 * stay NULL (no backfill — staff pin each centre from the Centres page).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('textile_dropoff_centres', function (Blueprint $table): void {
            $table->decimal('latitude', 10, 7)->nullable()->after('address');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
        });
    }

    public function down(): void
    {
        Schema::table('textile_dropoff_centres', function (Blueprint $table): void {
            $table->dropColumn(['latitude', 'longitude']);
        });
    }
};
