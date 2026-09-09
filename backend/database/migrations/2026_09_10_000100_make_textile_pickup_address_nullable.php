<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Drop-off bookings never need a premises address, so pickup_address
 * becomes nullable. Existing rows keep their addresses; no backfill.
 */
return new class extends Migration
{
    public function up(): void
    {
        // doctrine/dbal is not installed, so MySQL uses a raw MODIFY
        // instead of Blueprint::change().
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE textile_collection_requests MODIFY pickup_address TEXT NULL');

            return;
        }

        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->text('pickup_address')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Restoring NOT NULL would orphan dropoff rows created without an
        // address, so the column stays nullable on rollback.
    }
};
