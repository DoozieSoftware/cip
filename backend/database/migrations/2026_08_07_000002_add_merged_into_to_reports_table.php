<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Self-referencing FK that records which report a duplicate was
 * merged into. Populated by `ModerationService::merge()` and cleared
 * by `ReportService::disputeMerge()`. Without this, the canonical
 * link is buried in `report_status_history.metadata` and the merged
 * report is a dead end for the citizen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->uuid('merged_into')->nullable()->after('assigned_to');
            $table->timestamp('merged_at')->nullable()->after('merged_into');

            $table->foreign('merged_into')
                ->references('id')->on('reports')
                ->nullOnDelete();

            $table->index('merged_into');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->dropForeign(['merged_into']);
            $table->dropIndex(['merged_into']);
            $table->dropColumn(['merged_into', 'merged_at']);
        });
    }
};
