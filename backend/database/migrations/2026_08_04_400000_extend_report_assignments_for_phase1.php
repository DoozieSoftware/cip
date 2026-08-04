<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 1 assignment schema extension (docs/department-routing-implementation-plan.md §3.4).
 *
 *  - `is_primary`  — the report's root-cause owner assignment (at most one
 *    open primary per report; all pre-existing rows are primary)
 *  - `kind`        — 'primary' | 'secondary' (secondary = linked co-task,
 *    consumed in Track B)
 *  - `task_status` — task-level lifecycle ('open' | 'completed' | 'cancelled')
 *    so secondary tasks can close without touching the report's single
 *    global status column
 *  - `sla_minutes` — per-assignment SLA snapshot from the routing rule,
 *    enabling per-task deadlines
 *
 * Additive only; existing queries keep working because defaults preserve
 * current semantics.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_assignments', function (Blueprint $table): void {
            if (! Schema::hasColumn('report_assignments', 'is_primary')) {
                $table->boolean('is_primary')->default(true)->after('department_id');
            }

            if (! Schema::hasColumn('report_assignments', 'kind')) {
                $table->string('kind', 16)->default('primary')->after('is_primary');
            }

            if (! Schema::hasColumn('report_assignments', 'task_status')) {
                $table->string('task_status', 24)->default('open')->after('reassigned_at');
            }

            if (! Schema::hasColumn('report_assignments', 'sla_minutes')) {
                $table->unsignedInteger('sla_minutes')->nullable()->after('task_status');
            }

            $table->index(['report_id', 'is_primary'], 'ra_report_primary_idx');
            $table->index(['department_id', 'task_status'], 'ra_dept_task_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('report_assignments', function (Blueprint $table): void {
            $table->dropIndex('ra_report_primary_idx');
            $table->dropIndex('ra_dept_task_status_idx');
            $table->dropColumn(['is_primary', 'kind', 'task_status', 'sla_minutes']);
        });
    }
};
