<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T-M12-007 — `integrations` table.
 *
 * Super Admin CRUD for external system connectors (per
 * `docs/12` §34). One row per integration the platform
 * may call. The `provider` column is the connector class
 * name (e.g. "gmc", "bbmp", "pgportal", "sms_gateway").
 * The `credentials` column is JSON; the controller masks
 * the response but the value is written in clear.
 *
 *  - id            : UUID primary key
 *  - code          : unique slug (e.g. "gmc", "bbmp", "sms")
 *  - provider      : connector class
 *  - display_name  : human label
 *  - base_url      : endpoint root
 *  - credentials   : JSON map of secret-bearing values
 *  - settings      : JSON map of free-form provider config
 *  - status        : active | degraded | disabled
 *  - last_check_at : timestamp of the most recent health probe
 *  - last_error    : free-form error string (truncated)
 *  - timestamps, soft deletes
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integrations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 64)->unique();
            $table->string('provider', 64);
            $table->string('display_name', 128);
            $table->string('base_url', 512);
            $table->json('credentials')->nullable();
            $table->json('settings')->nullable();
            $table->string('status', 16)->default('active');
            $table->timestamp('last_check_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('provider');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE integrations ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('integrations');
    }
};
