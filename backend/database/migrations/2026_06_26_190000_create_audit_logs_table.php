<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Audit log table.
 *
 * Append-only record of every mutating request, per docs/11 §28 and
 * docs/04 §15. Captures: who, what, before/after JSON, IP, device
 * fingerprint, request id, when. The model blocks update/delete at
 * the Eloquent layer to enforce the append-only invariant.
 *
 * Fields:
 *   - uuid PK
 *   - user_id uuid FK -> users.id (nullable — some audits target a
 *     mobile / IP that has not yet been registered)
 *   - entity: short stable name of the affected model or domain
 *     (`report`, `auth`, `workflow`, `users`, `rbac`, ...)
 *   - entity_id: string PK of the affected row (uuid PK, no FK so
 *     audits can survive target deletion)
 *   - action: short verb (`create`, `update`, `delete`, `assign`,
 *     `close`, `login`, `logout`, `login_failed`, ...)
 *   - before: JSON snapshot of the row state before the change
 *     (null for creates)
 *   - after: JSON snapshot of the row state after the change
 *     (null for deletes; null when the change is action-only, e.g.
 *     a logout that does not mutate a model)
 *   - ip: source IP (string, 45 chars to fit IPv6)
 *   - device_fingerprint: SHA-256 hash from DeviceFingerprintService
 *     (64 chars)
 *   - request_id: trace id from the RequestId middleware
 *   - created_at only
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('entity', 64);
            $table->string('entity_id', 64)->nullable();
            $table->string('action', 32);
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('device_fingerprint', 64)->nullable();
            $table->string('request_id', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('user_id')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index('entity');
            $table->index('entity_id');
            $table->index('action');
            $table->index('user_id');
            $table->index('created_at');
            $table->index(['entity', 'entity_id']);
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.collation') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE audit_logs ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
