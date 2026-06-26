<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * OTP table for citizen authentication.
 *
 * Per docs/11 §6 (Citizen accounts use OTP only) and §21 (5 OTPs/hour):
 *   - uuid PK
 *   - mobile: indexed, the canonical identifier for citizens
 *   - code_hash: bcrypt of the 6-digit code (never store plaintext)
 *   - expires_at: timestamp, indexed for sweep
 *   - consumed_at: nullable timestamp; once set the OTP is dead
 *   - attempts: small unsigned int, capped at 5
 *   - ip: request IP that requested the OTP (for audit)
 *   - user_agent: request UA (for audit)
 *   - created_at only — no updated_at/deleted_at; OTPs are immutable records
 *
 * OTPs are rate-limited at the application layer (OtpService enforces 5/hour
 * per mobile) and the index on `mobile` + `expires_at` keeps the rate-limiter
 * query cheap.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otps', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('mobile', 32);
            $table->string('code_hash');
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['mobile', 'expires_at']);
            $table->index('expires_at');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.collation') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE otps ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('otps');
    }
};
