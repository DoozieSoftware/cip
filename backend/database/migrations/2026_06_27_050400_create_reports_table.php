<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `reports` table per docs/04 §7 and §24.
 *
 * Every report is anchored to a citizen (or `null` if anonymous
 * with an anonymous session id), a report_type, a location, a
 * status, and a priority. The Workflow engine (M6) will fill
 * `workflow_id` and `assigned_to` once it routes the report.
 *
 * Indexes: tracking_number (unique), department_id, status_id,
 * workflow_id, citizen_id, submitted_at, priority_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tracking_number', 32)->unique();
            $table->uuid('citizen_id')->nullable();
            $table->uuid('report_type_id');
            $table->uuid('department_id')->nullable();
            $table->uuid('current_status_id');
            $table->uuid('priority_id');
            $table->uuid('workflow_id')->nullable();
            $table->uuid('location_id');
            $table->uuid('assigned_to')->nullable();
            $table->string('title');
            $table->text('description');
            $table->decimal('ai_confidence', 5, 4)->nullable();
            $table->decimal('fraud_score', 5, 4)->nullable();
            $table->decimal('duplicate_score', 5, 4)->nullable();
            $table->boolean('is_anonymous')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('citizen_id')
                ->references('id')->on('users')
                ->nullOnDelete();
            $table->foreign('report_type_id')
                ->references('id')->on('report_types')
                ->restrictOnDelete();
            $table->foreign('department_id')
                ->references('id')->on('departments')
                ->nullOnDelete();
            $table->foreign('current_status_id')
                ->references('id')->on('report_statuses')
                ->restrictOnDelete();
            $table->foreign('priority_id')
                ->references('id')->on('report_priorities')
                ->restrictOnDelete();
            $table->foreign('location_id')
                ->references('id')->on('locations')
                ->restrictOnDelete();
            $table->foreign('assigned_to')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index('department_id');
            $table->index('current_status_id');
            $table->index('workflow_id');
            $table->index('citizen_id');
            $table->index('priority_id');
            $table->index('submitted_at');
            $table->index('report_type_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
