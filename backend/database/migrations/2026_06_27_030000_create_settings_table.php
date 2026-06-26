<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Global `settings` key/value table per docs/04 §18 (Configuration
 * Domain) and docs/09 §18 (Super Admin → Settings).
 *
 *  - id          : UUID primary key
 *  - key         : unique dotted-path key (e.g. "ai.vision.provider",
 *                  "uploads.max_size_mb")
 *  - value       : JSON column; the actual setting payload
 *  - type        : short string tag (string|int|bool|json|datetime)
 *  - description : human-readable description for the Super Admin UI
 *  - is_public   : bool — true means the citizen PWA can read this
 *                  setting without authentication
 *  - timestamps, deleted_at (soft deletes — `forget(key)` soft-deletes
 *    so the audit trail is preserved and the key can be restored)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->string('type', 16)->default('string');
            $table->string('description')->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index('is_public');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE settings ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
