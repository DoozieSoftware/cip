<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T-M12-013 — `organizations` table per `docs/09` §6.
 *
 * Multi-tenant scaffold. One row per organisation
 * (e.g. one city, one state, one NGO). The platform
 * can be deployed in single-tenant or multi-tenant
 * mode; this table is the source of truth for tenant
 * metadata.
 *
 *  - id          : UUID primary key
 *  - code        : unique slug (e.g. "gmc", "bbmp")
 *  - name        : display name
 *  - legal_name  : legal entity name
 *  - domain      : primary domain (e.g. "gmc.gov.in")
 *  - contact     : JSON map (email, phone, address)
 *  - branding    : JSON map (logo_url, primary_color, secondary_color)
 *  - storage_quota_mb : integer; per-tenant storage ceiling
 *  - settings    : JSON free-form
 *  - active      : bool
 *  - timestamps, soft deletes
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 64)->unique();
            $table->string('name', 128);
            $table->string('legal_name', 255)->nullable();
            $table->string('domain', 128)->nullable();
            $table->json('contact')->nullable();
            $table->json('branding')->nullable();
            $table->unsignedInteger('storage_quota_mb')->default(5120);
            $table->json('settings')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('active');
            $table->index('domain');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE organizations ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
