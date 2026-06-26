<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Security event table.
 *
 * Append-only audit log of security-relevant events (per docs/11 §29):
 *   - login success / failure
 *   - refresh-token rotation / reuse detection
 *   - forced logout
 *   - device mismatch
 *   - rate-limit trip
 *   - role/permission change
 *
 * The table is intentionally append-only. The model (T-M2-009) blocks
 * update/delete at the Eloquent layer to enforce this invariant.
 *
 * Fields:
 *   - uuid PK
 *   - user_id uuid FK -> users.id (nullable — events can target a mobile
 *     that hasn't been registered yet)
 *   - event: short constant (e.g. `login.succeeded`, `token.reuse_detected`)
 *   - severity: enum-ish string (`info`, `warning`, `critical`)
 *   - metadata: JSON blob (free-form payload, never PII)
 *   - ip, user_agent (nullable)
 *   - created_at only
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('event', 64);
            $table->string('severity', 16)->default('info');
            $table->json('metadata')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('user_id')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index('event');
            $table->index('severity');
            $table->index('user_id');
            $table->index('created_at');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.collation') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE security_events ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('security_events');
    }
};
