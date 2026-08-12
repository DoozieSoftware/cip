<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->timestamp('sla_due_at')->nullable()->after('submitted_at');
            $table->index(['sla_due_at', 'current_status_id', 'id'], 'reports_sla_due_status_id_index');
        });

        Schema::create('workflow_sla_breaches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->uuid('transition_id');
            $table->timestamp('breached_at')->useCurrent();
            $table->timestamp('notified_at')->nullable();
            $table->json('payload')->nullable();

            $table->foreign('report_id')->references('id')->on('reports')->cascadeOnDelete();
            $table->foreign('transition_id')->references('id')->on('workflow_transitions')->cascadeOnDelete();
            $table->unique(['report_id', 'transition_id'], 'workflow_sla_breaches_report_transition_unique');
            $table->index(['breached_at', 'notified_at'], 'workflow_sla_breaches_delivery_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_sla_breaches');
        Schema::table('reports', function (Blueprint $table): void {
            $table->dropIndex('reports_sla_due_status_id_index');
            $table->dropColumn('sla_due_at');
        });
    }
};
