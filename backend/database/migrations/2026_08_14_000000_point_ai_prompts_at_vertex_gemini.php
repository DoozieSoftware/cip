<?php

declare(strict_types=1);

use App\Modules\AI\Models\PromptVersion;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Point the approved proof_verification and category_classifier prompts
 * back at the Vertex Gemini provider.
 *
 * Both prompts drifted to `provider_code = 'modal-vision'` after the
 * seeder/migration intent of `vertex-gemini-flash`, so the report proof
 * pipeline routed every AI call to the self-hosted Modal vLLM endpoint
 * instead of Vertex Gemini. Vertex is now verified live
 * (google/gemini-3.7-flash) and the runtime model is env-driven, so the
 * approved prompt rows must pin the Vertex provider again.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('prompt_versions')
            ->whereIn('name', ['proof_verification', 'category_classifier'])
            ->where('status', PromptVersion::STATUS_APPROVED)
            ->update([
                'provider_code' => 'vertex-gemini-flash',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Reversible via the admin prompt UI; no-op here to avoid
        // pinning rows back to a provider we no longer prefer.
    }
};
