<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Rebuild the default `users` table to match the Civic Intelligence Platform
 * identity model described in docs/04 §6 and docs/11 §6:
 *
 *   - UUID primary key (HasUuids)
 *   - mobile: required, unique, indexed
 *   - email : nullable, unique, indexed
 *   - password: nullable (citizens authenticate via OTP only)
 *   - otp_verified_at, anonymous_enabled, status, last_login_at
 *   - soft deletes
 *
 * The original Laravel-default migration (0001_01_01_000000_create_users_table)
 * used an auto-increment id and a required password; per AGENTS.md we never
 * modify existing migrations, so this migration drops the legacy table and
 * recreates it with the platform contract. The default password_reset_tokens
 * and sessions tables are kept (used by Laravel's session/password flows).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table): void {
            // UUID primary key — HasUuids in the User model.
            $table->uuid('id')->primary();

            $table->string('name')->nullable();
            $table->string('mobile', 32);
            $table->string('email')->nullable();
            $table->string('password')->nullable();

            $table->timestamp('otp_verified_at')->nullable();
            $table->boolean('anonymous_enabled')->default(false);
            $table->string('status', 32)->default('active');
            $table->timestamp('last_login_at')->nullable();
            $table->string('last_login_ip', 45)->nullable();

            // Two-factor readiness — column present, TOTP enrollment lands later.
            $table->string('two_factor_secret')->nullable();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();

            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->unique('mobile');
            $table->unique('email');
            $table->index('status');
        });

        // MySQL-specific: set the engine/charset for the new table.
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.collation') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE users ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
