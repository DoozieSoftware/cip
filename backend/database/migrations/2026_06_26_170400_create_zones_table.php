<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Master `zones` table per docs/04 §8 (Location Domain).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zones', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('city_id');
            $table->string('name');
            $table->string('code', 8);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->foreign('city_id')
                ->references('id')->on('cities')
                ->restrictOnDelete();
            $table->unique(['city_id', 'code']);
            $table->index('active');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE zones ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('zones');
    }
};
