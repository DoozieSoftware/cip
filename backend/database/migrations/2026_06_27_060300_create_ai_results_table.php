<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `ai_results` table per docs/04 §10 and docs/10 §14.
 *
 * One row per successful (or failed-with-diagnostics) AI job.
 * Joined 1:1 to `ai_jobs` on `job_id`. Cascade on job delete
 * because a job's existence is meaningless without its result;
 * we never want orphan result rows.
 *
 *  - `confidence` is a 0.0000–1.0000 overall confidence
 *  - `quality_score`, `duplicate_score`, `fraud_score` are 0–100 ints
 *  - `raw_response` is the unparsed provider payload (JSON); we keep
 *    it for forensic / re-prompting / cost audit purposes
 *  - The spec only declares `created_at` (results are immutable —
 *    a re-run writes a new row keyed off a new `ai_jobs.id`)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_results', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('job_id');
            $table->string('predicted_type', 64);
            $table->decimal('confidence', 5, 4);
            $table->string('recommended_department', 64);
            $table->string('severity', 16);
            $table->unsignedSmallInteger('quality_score');
            $table->unsignedSmallInteger('duplicate_score');
            $table->unsignedSmallInteger('fraud_score');
            $table->text('summary');
            $table->json('raw_response');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('job_id')
                ->references('id')->on('ai_jobs')
                ->cascadeOnDelete();

            $table->index('job_id');
            $table->index('predicted_type');
            $table->index('severity');
            $table->index('recommended_department');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_results');
    }
};
