<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Refresh token table for Sanctum + custom rotation.
 *
 * Per docs/11 §7 (Refresh Token Rotation):
 *   - uuid PK
 *   - user_id uuid FK -> users.id (cascade on delete)
 *   - token_hash: bcrypt of the opaque refresh token (never plaintext)
 *   - parent_id uuid nullable FK -> refresh_tokens.id (rotation chain)
 *   - expires_at timestamp (e.g. +14 days)
 *   - revoked_at nullable (logout / forced revocation)
 *   - ip, user_agent nullable (audit context)
 *   - created_at only — no updated_at; tokens are immutable records
 *
 * Rotation logic lands in T-M2-007. The composite index on
 * (user_id, expires_at) supports the per-user active-token sweep.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refresh_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('token_hash');
            $table->uuid('parent_id')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('user_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();

            $table->foreign('parent_id')
                ->references('id')->on('refresh_tokens')
                ->nullOnDelete();

            $table->index(['user_id', 'expires_at']);
            $table->index('expires_at');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.collation') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE refresh_tokens ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
    }
};
