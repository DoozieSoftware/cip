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
        Schema::create('media_quarantines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('media_id')->unique();
            $table->string('status', 32);
            $table->string('reason', 32);
            $table->string('scanner', 64);
            $table->char('original_sha256', 64);
            $table->unsignedInteger('scan_attempts')->default(0);
            $table->string('last_error', 512)->nullable();
            $table->timestamp('quarantined_at');
            $table->timestamp('last_attempted_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();

            $table->foreign('media_id')
                ->references('id')->on('media')
                ->restrictOnDelete();

            $table->index(['status', 'last_attempted_at'], 'idx_media_quarantine_recovery');
            $table->index('reason', 'idx_media_quarantine_reason');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE media_quarantines
                 ADD CONSTRAINT media_quarantine_status_check
                 CHECK (status IN ('PENDING_RESCAN','RESCANNING','CONFIRMED_INFECTED','INTEGRITY_FAILED','RELEASED'))"
            );
            DB::statement(
                "ALTER TABLE media_quarantines
                 ADD CONSTRAINT media_quarantine_reason_check
                 CHECK (reason IN ('AWAITING_SCAN','INFECTED','SCANNER_ERROR','RELEASE_ERROR','INTEGRITY_MISMATCH'))"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE media_quarantines DROP CONSTRAINT media_quarantine_status_check');
            DB::statement('ALTER TABLE media_quarantines DROP CONSTRAINT media_quarantine_reason_check');
        }

        Schema::dropIfExists('media_quarantines');
    }
};
