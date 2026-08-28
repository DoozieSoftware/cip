<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('textile_collection_batches', function (Blueprint $table): void {
            $table->uuid('assigned_team_id')->nullable()->after('created_by');
            $table->uuid('assigned_user_id')->nullable()->after('assigned_team_id');
            $table->string('vehicle_label', 64)->nullable()->after('assigned_user_id');
            $table->text('assignment_reason')->nullable()->after('vehicle_label');
            $table->uuid('assigned_by')->nullable()->after('assignment_reason');
            $table->timestamp('assigned_at')->nullable()->after('assigned_by');
            $table->timestamp('started_at')->nullable()->after('assigned_at');
            $table->timestamp('completed_at')->nullable()->after('started_at');
            $table->unsignedInteger('row_version')->default(0)->after('completed_at');
            $table->foreign('assigned_team_id')->references('id')->on('departments')->nullOnDelete();
            $table->foreign('assigned_user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('assigned_by')->references('id')->on('users')->nullOnDelete();
            // Explicit names: MySQL identifiers are capped at 64 chars.
            $table->index(['assigned_user_id', 'status', 'collection_date'], 'tcb_assigned_user_status_date_idx');
            $table->index(['assigned_team_id', 'collection_date'], 'tcb_assigned_team_date_idx');
            // TODO D-04: textile_batch_stops option (b) pending decision
        });
    }

    public function down(): void
    {
        Schema::table('textile_collection_batches', function (Blueprint $table): void {
            $table->dropIndex('tcb_assigned_team_date_idx');
            $table->dropIndex('tcb_assigned_user_status_date_idx');
            $table->dropForeign(['assigned_team_id']);
            $table->dropForeign(['assigned_user_id']);
            $table->dropForeign(['assigned_by']);
            $table->dropColumn(['assigned_team_id', 'assigned_user_id', 'vehicle_label', 'assignment_reason', 'assigned_by', 'assigned_at', 'started_at', 'completed_at', 'row_version']);
        });
    }
};
