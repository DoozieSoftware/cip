<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T-M12-009 — `notification_channel_configs` table.
 *
 * One row per channel credential bundle (mail, push, sms,
 * webhook). The Super Admin screen edits these at runtime;
 * the dispatcher reads them at send time.
 *
 *  - id           : UUID primary key
 *  - channel      : mail | push | sms | webhook
 *  - code         : unique per-channel slug (e.g. "default",
 *                   "sms-tx", "fcm-prod")
 *  - display_name : human label
 *  - credentials  : JSON map (api_key, token, host, …) — the
 *                   resource masks the response
 *  - retry_policy : JSON { "tries": 5, "backoff": [60,300,900,3600] }
 *  - settings     : JSON free-form (from, headers, sign HMAC, …)
 *  - per_locale_defaults : JSON { "en": { "from": "noreply@…" }, "hi": {…} }
 *  - active       : bool
 *  - timestamps, soft deletes
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_channel_configs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('channel', 16);
            $table->string('code', 64);
            $table->string('display_name', 128);
            $table->json('credentials')->nullable();
            $table->json('retry_policy')->nullable();
            $table->json('settings')->nullable();
            $table->json('per_locale_defaults')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['channel', 'code'], 'notification_channel_configs_channel_code_uq');
            $table->index('channel');
            $table->index('active');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE notification_channel_configs ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_channel_configs');
    }
};
