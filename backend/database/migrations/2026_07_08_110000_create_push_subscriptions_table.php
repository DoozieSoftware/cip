<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `push_subscriptions` table per docs/04 §13 (T-M13).
 *
 * Stores a citizen's Web Push subscription so the platform can
 * deliver status-change notifications to their device. One row
 * per (user, endpoint); the endpoint is unique because the browser
 * issues a stable push endpoint per subscription.
 *
 * Indexes:
 *  - (user_id) for fast per-citizen lookups
 *  - (endpoint) unique so re-subscribes replace rather than duplicate
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('endpoint', 512)->unique();
            $table->json('keys');
            $table->string('content_encoding', 32)->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
