<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Binds department proof to the assignment and agency that produced it.
 *
 * Citizen evidence remains report-owned (`assignment_id` and
 * `department_id` are null). Department proof written after this migration
 * always carries both foreign keys. Existing proof is backfilled from the
 * report's matching, non-reassigned assignment where one exists; unresolved
 * legacy rows remain null and are consequently hidden from department-scoped
 * readers until an administrator reconciles them.
 *
 * The same ownership dimensions are copied onto the append-only custody log
 * so access investigations do not depend on mutable joins to reconstruct the
 * agency/task scope that applied when the event occurred.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table): void {
            $table->uuid('assignment_id')->nullable()->after('report_id');
            $table->uuid('department_id')->nullable()->after('assignment_id');

            $table->foreign('assignment_id')
                ->references('id')->on('report_assignments')
                ->restrictOnDelete();
            $table->foreign('department_id')
                ->references('id')->on('departments')
                ->restrictOnDelete();

            $table->index('assignment_id', 'media_assignment_idx');
            $table->index(
                ['report_id', 'department_id', 'role'],
                'media_report_department_role_idx',
            );
        });

        Schema::table('media_access_logs', function (Blueprint $table): void {
            $table->uuid('assignment_id')->nullable()->after('media_id');
            $table->uuid('department_id')->nullable()->after('assignment_id');

            $table->foreign('assignment_id')
                ->references('id')->on('report_assignments')
                ->restrictOnDelete();
            $table->foreign('department_id')
                ->references('id')->on('departments')
                ->restrictOnDelete();

            $table->index(
                ['assignment_id', 'created_at'],
                'media_access_assignment_created_idx',
            );
            $table->index(
                ['department_id', 'created_at'],
                'media_access_department_created_idx',
            );
        });

        // Portable correlated subqueries keep the backfill executable in the
        // SQLite test harness and MySQL production without loading models in a
        // migration. Assignment selection is deterministic and prefers the
        // current primary row before the newest matching task.
        DB::statement(<<<'SQL'
            UPDATE media
            SET department_id = (
                SELECT reports.department_id
                FROM reports
                WHERE reports.id = media.report_id
            )
            WHERE role = 'proof'
              AND department_id IS NULL
        SQL);

        DB::statement(<<<'SQL'
            UPDATE media
            SET assignment_id = (
                SELECT report_assignments.id
                FROM report_assignments
                WHERE report_assignments.report_id = media.report_id
                  AND report_assignments.department_id = media.department_id
                  AND report_assignments.reassigned_at IS NULL
                  AND report_assignments.task_status IN ('open', 'completed')
                ORDER BY report_assignments.is_primary DESC,
                         report_assignments.assigned_at DESC,
                         report_assignments.id DESC
                LIMIT 1
            )
            WHERE role = 'proof'
              AND assignment_id IS NULL
        SQL);

        DB::statement(<<<'SQL'
            UPDATE media_access_logs
            SET assignment_id = (
                    SELECT media.assignment_id
                    FROM media
                    WHERE media.id = media_access_logs.media_id
                ),
                department_id = (
                    SELECT media.department_id
                    FROM media
                    WHERE media.id = media_access_logs.media_id
                )
            WHERE assignment_id IS NULL
               OR department_id IS NULL
        SQL);

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE media_access_logs DROP CONSTRAINT media_access_logs_event_check');
            DB::statement(
                "ALTER TABLE media_access_logs
                 ADD CONSTRAINT media_access_logs_event_check
                 CHECK (event IN ('UPLOAD','VIEW','DOWNLOAD','REPLACE','DELETE','VIRUS_SCAN'))"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE media_access_logs DROP CONSTRAINT media_access_logs_event_check');
            DB::statement(
                "ALTER TABLE media_access_logs
                 ADD CONSTRAINT media_access_logs_event_check
                 CHECK (event IN ('VIEW','DOWNLOAD','REPLACE','DELETE','VIRUS_SCAN'))"
            );
        }

        Schema::table('media_access_logs', function (Blueprint $table): void {
            $table->dropIndex('media_access_assignment_created_idx');
            $table->dropIndex('media_access_department_created_idx');
            $table->dropForeign(['assignment_id']);
            $table->dropForeign(['department_id']);
            $table->dropColumn(['assignment_id', 'department_id']);
        });

        Schema::table('media', function (Blueprint $table): void {
            $table->dropIndex('media_assignment_idx');
            $table->dropIndex('media_report_department_role_idx');
            $table->dropForeign(['assignment_id']);
            $table->dropForeign(['department_id']);
            $table->dropColumn(['assignment_id', 'department_id']);
        });
    }
};
