<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `prompt_versions` table per docs/10 §15.
 *
 * Prompt registry with a `draft | approved | deprecated` lifecycle.
 * Only one row per `(name, status=approved)` is meant to be the
 * "current" prompt at any time; the Super Admin Portal's approve
 * endpoint flips the previous approved row to `deprecated` and
 * marks the new row `approved` inside a single transaction.
 *
 *  - `name` is the prompt slug (e.g. `category_classifier`,
 *    `severity_estimator`, `ai_labeller`)
 *  - `version` is a per-name monotonic int
 *  - `provider_code` references `ai_provider_configs.code` (no
 *    FK; cross-module loose reference, matches the spec)
 *  - `expected_json_schema` is the JSON shape the orchestrator
 *    validates the provider's response against before publishing
 *    the `ai_label` to `reports.ai_label`
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prompt_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 128);
            $table->unsignedInteger('version');
            $table->string('purpose', 255)->nullable();
            $table->string('provider_code', 64);
            $table->text('prompt_text');
            $table->json('expected_json_schema')->nullable();
            $table->string('status', 16)->default('draft');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->unique(['name', 'version']);
            $table->index(['name', 'status']);
            $table->index('provider_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prompt_versions');
    }
};
