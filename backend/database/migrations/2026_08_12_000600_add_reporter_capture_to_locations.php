<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Preserve the device capture independently from a manually selected issue pin. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table): void {
            $table->decimal('reporter_latitude', 10, 7)->nullable()->after('longitude');
            $table->decimal('reporter_longitude', 10, 7)->nullable()->after('reporter_latitude');
            $table->decimal('reporter_accuracy', 8, 2)->nullable()->after('reporter_longitude');
            $table->string('reporter_gps_provider', 32)->nullable()->after('reporter_accuracy');
            $table->timestamp('reporter_captured_at')->nullable()->after('reporter_gps_provider');
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table): void {
            $table->dropColumn([
                'reporter_latitude',
                'reporter_longitude',
                'reporter_accuracy',
                'reporter_gps_provider',
                'reporter_captured_at',
            ]);
        });
    }
};
