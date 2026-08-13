<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table): void {
            // Existing rows were persisted only after the legacy synchronous
            // scanner returned CLEAN. New uploads explicitly move through
            // PENDING/UNKNOWN/INFECTED before becoming deliverable as CLEAN.
            $table->string('scan_status', 16)->default('CLEAN')->after('checksum');
            $table->timestamp('scan_attempted_at')->nullable()->after('scan_status');
            $table->index('scan_status', 'idx_media_scan_status');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE media
                 ADD CONSTRAINT media_scan_status_check
                 CHECK (scan_status IN ('PENDING','CLEAN','INFECTED','UNKNOWN'))"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE media DROP CONSTRAINT media_scan_status_check');
        }

        Schema::table('media', function (Blueprint $table): void {
            $table->dropIndex('idx_media_scan_status');
            $table->dropColumn(['scan_status', 'scan_attempted_at']);
        });
    }
};
