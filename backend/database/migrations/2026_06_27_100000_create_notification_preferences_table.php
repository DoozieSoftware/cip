<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-(user, channel, event_code) opt-in flag.
 *
 * A row present means the user is opt-in for the
 * channel + event_code combination. Absence = default
 * (opt-in for citizen-internal events, opt-out for
 * marketing-style events). The dispatcher reads the
 * preferences service before creating the row.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_preferences', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('channel', 16);
            $table->string('event_code', 64);
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'channel', 'event_code'], 'notification_preferences_user_channel_event_uq');
            $table->index(['user_id', 'enabled'], 'notification_preferences_user_enabled_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_preferences');
    }
};
