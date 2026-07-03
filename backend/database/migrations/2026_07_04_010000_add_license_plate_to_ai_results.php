<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `license_plate` to `ai_results` for ANPR (Automatic Number
 * Plate Recognition).
 *
 * The same vision-language model that classifies the report also
 * reads the license plate from the photo when the report category
 * is a vehicle violation (illegal_parking, etc.). The plate is
 * stored here for the moderator review panel and the routing
 * engine (vehicle violation reports can be cross-referenced by
 * plate number).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_results', function (Blueprint $table): void {
            $table->string('license_plate', 32)->nullable()->after('summary');
            $table->float('plate_confidence')->nullable()->after('license_plate');
            $table->index('license_plate');
        });
    }

    public function down(): void
    {
        Schema::table('ai_results', function (Blueprint $table): void {
            $table->dropIndex(['license_plate']);
            $table->dropColumn(['license_plate', 'plate_confidence']);
        });
    }
};
