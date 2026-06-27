<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `ai_jobs` table per docs/04 §10.
 *
 * One row per attempt to run the vision pipeline on a report.
 * Multiple rows per report_id are expected (retries); the
 * `ai_results` table (T-M8-004) holds the actual response
 * payload, joined 1:1 on `job_id` when the job succeeds.
 *
 *  - status: `queued`, `running`, `succeeded`, `failed`, `timeout`
 *  - retry_count: number of retries already attempted for this job
 *  - tokens_in / tokens_out: provider usage (nullable for the
 *    local stub provider)
 *  - cost_cents: billed cost in cents (nullable)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->uuid('prompt_version_id');
            $table->string('provider_code', 64);
            $table->string('model', 255);
            $table->string('status', 16)->default('queued');
            $table->timestamp('requested_at')->useCurrent();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('processing_time_ms')->nullable();
            $table->string('error_code', 64)->nullable();
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->unsignedInteger('tokens_in')->nullable();
            $table->unsignedInteger('tokens_out')->nullable();
            $table->unsignedInteger('cost_cents')->nullable();
            $table->timestamps();

            $table->foreign('report_id')
                ->references('id')->on('reports')
                ->cascadeOnDelete();
            $table->foreign('prompt_version_id')
                ->references('id')->on('prompt_versions')
                ->restrictOnDelete();

            $table->index('status');
            $table->index('report_id');
            $table->index(['report_id', 'status']);
            $table->index('provider_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_jobs');
    }
};
