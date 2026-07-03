<?php

declare(strict_types=1);

use App\Modules\AI\Models\AiProviderConfig;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fixes the AI-provider container-binding gap identified in the
 * post-audit remediation plan: `ai_provider_configs` had no
 * type-discriminator column, so nothing could ever construct the
 * right `AIProviderInterface` implementation for a row at runtime.
 *
 *  - `driver`         type discriminator consumed by AiProviderFactory
 *                     (`qwen_vl` | `openai_compatible`)
 *  - `extra_headers`  json, nullable — static headers a custom
 *                     OpenAI-compatible endpoint needs (e.g.
 *                     OpenRouter's `HTTP-Referer`/`X-Title`)
 *  - `credentials`    encrypted json (Laravel `encrypted:array` cast
 *                     on the model), replacing the never-populated
 *                     `api_key_secret_id` (no secret store exists)
 *
 * `api_key_secret_id` is dropped: it was write-only dead weight
 * (nothing ever read it — see AiProviderConfig.php docblock prior to
 * this migration) and is fully superseded by `credentials`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_provider_configs', function (Blueprint $table): void {
            $table->string('driver', 32)->default('openai_compatible')->after('code');
            $table->json('extra_headers')->nullable()->after('auth_type');
            $table->text('credentials')->nullable()->after('extra_headers');
        });

        // Backfill the driver for the three rows the AiProvidersSeeder ships.
        AiProviderConfig::query()->where('code', 'mock')->update(['driver' => 'mock']);
        AiProviderConfig::query()->where('code', 'qwen-vl')->update(['driver' => 'qwen_vl']);
        AiProviderConfig::query()->where('code', 'openai')->update(['driver' => 'openai_compatible']);

        Schema::table('ai_provider_configs', function (Blueprint $table): void {
            $table->dropColumn('api_key_secret_id');
        });
    }

    public function down(): void
    {
        Schema::table('ai_provider_configs', function (Blueprint $table): void {
            $table->uuid('api_key_secret_id')->nullable();
            $table->dropColumn(['driver', 'extra_headers', 'credentials']);
        });
    }
};
