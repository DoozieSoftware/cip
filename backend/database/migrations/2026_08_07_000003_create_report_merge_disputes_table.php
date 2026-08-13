<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Citizen disputes of an incorrect merge. A dispute records the
 * citizen's reason and resets the merged report out of the `merged`
 * terminal state so it can be re-reviewed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_merge_disputes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->uuid('citizen_id');
            $table->text('reason');
            $table->string('status', 32)->default('open');
            $table->text('resolution_note')->nullable();
            $table->uuid('resolved_by')->nullable();
            $table->timestamps();

            $table->foreign('report_id')
                ->references('id')->on('reports')
                ->cascadeOnDelete();
            $table->foreign('citizen_id')
                ->references('id')->on('users')
                ->nullOnDelete();
            $table->foreign('resolved_by')
                ->references('id')->on('users')
                ->nullOnDelete();

            $table->index(['report_id', 'status']);
            $table->index(['citizen_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_merge_disputes');
    }
};
