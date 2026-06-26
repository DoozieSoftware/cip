<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Master `countries` table per docs/04 §8 (Location Domain).
 *
 *  - id          : UUID primary key
 *  - name        : display name
 *  - iso2        : ISO 3166-1 alpha-2 (unique)
 *  - iso3        : ISO 3166-1 alpha-3
 *  - phone_code  : international dialing code (e.g. +91)
 *  - active      : soft-disable flag
 *  - timestamps
 *
 * InnoDB / utf8mb4 (per docs/16 §2). Existing migrations are
 * never modified, so this is a new file.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('countries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('iso2', 2);
            $table->string('iso3', 3)->nullable();
            $table->string('phone_code', 8)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique('iso2');
            $table->index('active');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE countries ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('countries');
    }
};
