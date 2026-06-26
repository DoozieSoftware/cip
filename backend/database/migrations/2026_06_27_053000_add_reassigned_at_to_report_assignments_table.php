<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `reassigned_at` to `report_assignments` for the M7
 * reassignment flow. The T-M7-010 endpoint marks the
 * previous row with a non-null `reassigned_at` and inserts
 * a fresh row; the active assignment is the row whose
 * `reassigned_at IS NULL AND completed_at IS NULL`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_assignments', function (Blueprint $table): void {
            $table->timestamp('reassigned_at')->nullable()->after('reassignment_reason');
            $table->index(['report_id', 'reassigned_at']);
        });
    }

    public function down(): void
    {
        Schema::table('report_assignments', function (Blueprint $table): void {
            $table->dropIndex(['report_id', 'reassigned_at']);
            $table->dropColumn('reassigned_at');
        });
    }
};
