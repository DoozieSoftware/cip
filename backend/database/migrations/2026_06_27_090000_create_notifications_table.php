<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `notifications` table per docs/04 §13.
 *
 * Stores pending and sent notifications dispatched by the
 * M9 Notification & Eventing Platform. One row per
 * (user, event) — the dispatcher collapses duplicate
 * templates in the same channel/window.
 *
 * Indexes:
 *  - (user_id, status) so the citizen inbox can
 *    SELECT WHERE user_id = ? AND status = 'sent' fast
 *  - (scheduled_at) so the SendNotificationJob queue
 *    can poll for scheduled rows efficiently
 *  - (status, scheduled_at) for the dead-letter sweep
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('type', 64);
            $table->string('channel', 16);
            $table->json('payload');
            $table->string('status', 16)->default('pending');
            $table->timestamp('read_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->unsignedInteger('retry_count')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();

            $table->index(['user_id', 'status']);
            $table->index('scheduled_at');
            $table->index(['status', 'scheduled_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
