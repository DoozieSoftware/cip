<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links media rows to textile collection requests.
 *
 * - Makes `report_id` nullable so the same `media` table can serve
 *   both complaint evidence (report-owned) and textile collection
 *   photos (collection-owned).
 * - Adds a nullable `textile_collection_id` FK pointing at
 *   `textile_collection_requests`. Photos belong to either a report
 *   OR a textile collection, never both.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table): void {
            $table->uuid('textile_collection_id')->nullable()->after('department_id');

            $table->foreign('textile_collection_id')
                ->references('id')->on('textile_collection_requests')
                ->nullOnDelete();

            $table->index('textile_collection_id', 'media_textile_collection_idx');

            // Make report_id nullable so textile photos (which have no
            // report) can be stored in the same table.
            $table->uuid('report_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('media', function (Blueprint $table): void {
            $table->dropIndex('media_textile_collection_idx');
            $table->dropForeign(['textile_collection_id']);
            $table->dropColumn('textile_collection_id');

            // Restore NOT NULL — existing rows all have a report_id so
            // this is safe on production data. In dev/test with textile
            // photos, run a rollback migration first.
            $table->uuid('report_id')->nullable(false)->change();
        });
    }
};
