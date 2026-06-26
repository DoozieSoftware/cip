<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `report_assignments` table per docs/04 §7 and §12.
 *
 * Tracks ownership. A report can be reassigned — a new row is
 * inserted, the previous row is preserved. The active assignment
 * is the one with `completed_at IS NULL AND accepted_at IS NOT NULL`
 * (or just `accepted_at IS NULL` while pending acceptance).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_assignments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->uuid('department_id');
            $table->uuid('officer_id')->nullable();
            $table->uuid('assigned_by')->nullable();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('reassignment_reason')->nullable();
            $table->timestamps();

            $table->foreign('report_id')
                ->references('id')->on('reports')
                ->cascadeOnDelete();
            $table->foreign('department_id')
                ->references('id')->on('departments')
                ->restrictOnDelete();
            $table->foreign('officer_id')
                ->references('id')->on('users')
                ->nullOnDelete();
            $table->foreign('assigned_by')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index(['report_id', 'completed_at']);
            $table->index(['department_id', 'accepted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_assignments');
    }
};
