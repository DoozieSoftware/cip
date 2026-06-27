<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `notification_logs` table per docs/04 §13.
 *
 * Append-only delivery history. The application-level model
 * (T-M9-004) blocks update/delete; the DB has no soft-delete
 * and no updated_at. One row per delivery attempt.
 *
 * Useful for:
 *  - delivery audit
 *  - rate-limit decisions (last attempt per user/channel)
 *  - provider SLAs (latency tracking)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('notification_id');
            $table->string('channel', 16);
            $table->string('status', 16);
            $table->json('provider_response')->nullable();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->timestamp('attempted_at')->useCurrent();

            $table->foreign('notification_id')
                ->references('id')->on('notifications')
                ->cascadeOnDelete();

            $table->index('notification_id');
            $table->index(['channel', 'attempted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
    }
};
