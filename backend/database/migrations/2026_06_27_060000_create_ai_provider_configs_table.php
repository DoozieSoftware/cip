<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `ai_provider_configs` table per docs/04 §10 and docs/10 §29.
 *
 * One row per provider (OpenAI, Azure OpenAI, local Qwen, etc).
 * The `code` is the natural key referenced by `prompt_versions.provider_code`
 * and by the per-feature `vision.provider` setting.
 *
 *  - `code`           unique natural key (e.g. `openai`, `azure_openai`, `local_qwen`)
 *  - `base_url`       HTTP endpoint (no trailing slash)
 *  - `auth_type`      enum-like string: `bearer`, `api_key`, `none`
 *  - `api_key_secret_id` UUID reference to a secret store (no FK; the
 *                     secrets module ships later)
 *  - `temperature`    decimal 0.0..2.0
 *  - `timeout_ms`     int 1000..600000
 *  - `retry_count`    int 0..10
 *  - `is_fallback`    bool — true means this is a fallback provider
 *  - `priority`       int — lower = higher precedence within fallback class
 *  - `active`         bool — disabled rows are ignored at resolve time
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_provider_configs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 64)->unique();
            $table->string('name', 255);
            $table->string('base_url', 1024);
            $table->string('auth_type', 32)->default('bearer');
            $table->uuid('api_key_secret_id')->nullable();
            $table->string('model', 255);
            $table->decimal('temperature', 3, 2)->default(0.20);
            $table->unsignedInteger('timeout_ms')->default(30000);
            $table->unsignedSmallInteger('retry_count')->default(2);
            $table->boolean('is_fallback')->default(false);
            $table->unsignedInteger('priority')->default(100);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index('is_fallback');
            $table->index('active');
            $table->index('priority');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_provider_configs');
    }
};
