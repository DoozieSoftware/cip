<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `media_access_logs` table per docs/04 §15 and docs/11 §15.
 *
 * Append-only audit log of every read or write that touches a
 * media row: VIEW (the list endpoint), DOWNLOAD (the signed
 * serve endpoint), REPLACE (chain-of-custody replacement),
 * DELETE (hard-delete via M16 hardening), and VIRUS_SCAN
 * (ClamAvScanner verdicts).
 *
 * The table is the primary artifact of the chain-of-custody
 * requirement (docs/11 §15): every event captures actor, IP,
 * user agent, and a free-form metadata JSON for the
 * event-specific context (the bytes the scanner saw, the
 * previous hash on a replacement, etc.).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_access_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('media_id');
            $table->uuid('actor_id')->nullable(); // null for system / unsigned events
            $table->string('event', 32); // VIEW | DOWNLOAD | REPLACE | DELETE | VIRUS_SCAN
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('media_id')
                ->references('id')->on('media')
                ->restrictOnDelete();
            $table->foreign('actor_id')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index(['media_id', 'created_at']);
            $table->index('event');
            $table->index('actor_id');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE media_access_logs
                 ADD CONSTRAINT media_access_logs_event_check
                 CHECK (event IN ('VIEW','DOWNLOAD','REPLACE','DELETE','VIRUS_SCAN'))"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE media_access_logs DROP CONSTRAINT media_access_logs_event_check');
        }
        Schema::dropIfExists('media_access_logs');
    }
};
