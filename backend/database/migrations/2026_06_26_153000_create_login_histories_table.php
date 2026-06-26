<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Login history table.
 *
 * One row per authentication attempt (success or failure). Used by
 * the moderator / super-admin portals to show "last login at..." and
 * to power the security-event stream (docs/11 §28).
 *
 * Per docs/11 §6 (auth) and §28 (audit):
 *   - uuid PK
 *   - user_id uuid FK -> users.id (nullable — failures may target a
 *     mobile that doesn't yet have a user; citizens authenticate by
 *     mobile first, the user is upserted after success)
 *   - mobile: the mobile number the attempt targeted (always present)
 *   - ip, user_agent, device_fingerprint (nullable, 64 chars)
 *   - success: boolean
 *   - failure_reason: nullable string (e.g. "invalid_code", "expired")
 *   - login_at: timestamp
 *
 * Immutable record (no updated_at/deleted_at).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_histories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('mobile', 32);
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('device_fingerprint', 64)->nullable();
            $table->boolean('success')->default(false);
            $table->string('failure_reason', 64)->nullable();
            $table->timestamp('login_at')->useCurrent();

            $table->foreign('user_id')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index('mobile');
            $table->index('user_id');
            $table->index(['success', 'login_at']);
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.collation') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE login_histories ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('login_histories');
    }
};
