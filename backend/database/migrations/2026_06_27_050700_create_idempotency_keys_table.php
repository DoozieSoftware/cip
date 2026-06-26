<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `idempotency_keys` table per docs/05 §20.
 *
 * Stores the response of a request keyed by the client-supplied
 * `Idempotency-Key` header. On a replay (same key + same user) the
 * middleware returns the stored response without re-running the
 * handler.
 *
 * The `request_hash` lets the middleware detect a key reuse with a
 * different payload (409 IDEMPOTENCY_KEY_CONFLICT).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('key', 128);
            $table->uuid('user_id')->nullable();
            $table->string('route', 191);
            $table->string('request_hash', 64);
            $table->unsignedSmallInteger('response_status');
            $table->json('response_body')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['key', 'user_id']);
            $table->foreign('user_id')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }
};
