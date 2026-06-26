<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Master `states` table per docs/04 §8 (Location Domain).
 *
 *  - id          : UUID primary key
 *  - country_id  : UUID FK → countries.id (restrict on delete)
 *  - name        : display name
 *  - code        : state code (e.g. KA, MH)
 *  - active      : soft-disable flag
 *  - timestamps
 *
 * Unique index on (country_id, code) — a state code is unique
 * within a country, not globally.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('states', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('country_id');
            $table->string('name');
            $table->string('code', 8);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->foreign('country_id')
                ->references('id')->on('countries')
                ->restrictOnDelete();
            $table->unique(['country_id', 'code']);
            $table->index('active');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.collation') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE states ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('states');
    }
};
