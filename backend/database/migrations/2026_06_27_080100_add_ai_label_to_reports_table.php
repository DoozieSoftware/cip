<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `ai_label` (string, 64, nullable) to `reports`.
 *
 * Populated by the M10 vision engine with the dominant
 * detected label (e.g. "pothole", "garbage_dump", "broken_streetlight").
 * The M7 RoutingCondition DSL reads it via the `ai_label_in`
 * operator (T-M7-003). Stored on the report itself rather than
 * a separate `ai_results` row so the routing engine can
 * evaluate the rule set with a single SELECT.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->string('ai_label', 64)->nullable()->after('ai_confidence');
            $table->index('ai_label');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE reports ADD INDEX reports_ai_label_idx (ai_label)");
        }
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->dropIndex('reports_ai_label_idx');
            $table->dropColumn('ai_label');
        });
    }
};
