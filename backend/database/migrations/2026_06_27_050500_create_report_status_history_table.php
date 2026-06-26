<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `report_status_history` table per docs/04 §7.
 *
 * Append-only timeline of every status change. Every row is
 * inserted by the WriteStatusHistory listener (T-M4-018). The
 * `metadata` column carries the transition context (assignment id,
 * reason, AI confidence, etc.).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_status_history', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->uuid('from_status_id')->nullable();
            $table->uuid('to_status_id');
            $table->uuid('actor_id')->nullable();
            $table->text('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('report_id')
                ->references('id')->on('reports')
                ->cascadeOnDelete();
            $table->foreign('from_status_id')
                ->references('id')->on('report_statuses')
                ->nullOnDelete();
            $table->foreign('to_status_id')
                ->references('id')->on('report_statuses')
                ->restrictOnDelete();
            $table->foreign('actor_id')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index(['report_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_status_history');
    }
};
