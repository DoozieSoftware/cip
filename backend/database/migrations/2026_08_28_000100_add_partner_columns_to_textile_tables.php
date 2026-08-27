<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. New table: textile_partner_capabilities ────────────────
        Schema::create('textile_partner_capabilities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('department_id');
            $table->string('category', 32);
            $table->timestamps();

            $table->foreign('department_id')->references('id')->on('departments')->restrictOnDelete();
            $table->unique(['department_id', 'category']);
        });

        // ── 2. textile_service_zones + department_id ──────────────────
        Schema::table('textile_service_zones', function (Blueprint $table): void {
            $table->uuid('department_id')->nullable()->after('code');
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->index('department_id');
        });

        // Backfill existing zones → DR_LINEN department
        $drLinenId = DB::table('departments')->where('code', 'DR_LINEN')->value('id');

        if ($drLinenId !== null) {
            DB::table('textile_service_zones')
                ->whereNull('department_id')
                ->update(['department_id' => $drLinenId, 'updated_at' => now()]);
        }

        // ── 3. textile_collection_requests + category + department_id ─
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->string('category', 32)->nullable()->after('notes');
            $table->uuid('department_id')->nullable()->after('service_zone_id');
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->index('department_id');
        });

        // Backfill: all existing rows → clothes_waste + DR_LINEN
        if ($drLinenId !== null) {
            DB::table('textile_collection_requests')
                ->whereNull('category')
                ->update([
                    'category' => 'clothes_waste',
                    'department_id' => $drLinenId,
                    'updated_at' => now(),
                ]);
        }

        // ── 4. Seed DR_LINEN capability ──────────────────────────────
        if ($drLinenId !== null) {
            $exists = DB::table('textile_partner_capabilities')
                ->where('department_id', $drLinenId)
                ->where('category', 'clothes_waste')
                ->exists();

            if (! $exists) {
                DB::table('textile_partner_capabilities')->insert([
                    'id' => (string) Str::uuid(),
                    'department_id' => $drLinenId,
                    'category' => 'clothes_waste',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->dropForeign(['department_id']);
            $table->dropIndex(['department_id']);
            $table->dropColumn(['category', 'department_id']);
        });

        Schema::table('textile_service_zones', function (Blueprint $table): void {
            $table->dropForeign(['department_id']);
            $table->dropIndex(['department_id']);
            $table->dropColumn('department_id');
        });

        Schema::dropIfExists('textile_partner_capabilities');
    }
};
