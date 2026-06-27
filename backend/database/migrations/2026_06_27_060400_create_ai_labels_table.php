<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `ai_labels` table per docs/04 §10 and docs/10 §11.
 *
 * Per-label confidence for multi-label classification results
 * (e.g. "pothole" + "road_damage" + "low_priority"). One row
 * per label returned by the provider; exactly one row per
 * `result_id` should have `is_primary = true` to mark the
 * top-label. The application enforces single-primary in the
 * AiLabel model (T-M8-006), not the DB.
 *
 * Cascade on `result_id` mirrors `ai_results` cascade from
 * `ai_jobs` — labels are meaningless without their result.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_labels', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('result_id');
            $table->string('label', 64);
            $table->decimal('confidence', 5, 4);
            $table->boolean('is_primary')->default(false);
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('result_id')
                ->references('id')->on('ai_results')
                ->cascadeOnDelete();

            $table->index('result_id');
            $table->index('label');
            $table->index(['result_id', 'is_primary']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_labels');
    }
};
