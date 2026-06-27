<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\AI\Models\PromptVersion;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds the base system prompts referenced from docs/10 §16–17.
 * Each prompt is a v1 `approved` row so the orchestrator (T-M8-018)
 * can resolve them without any Super Admin intervention.
 *
 * Idempotent: the (name, version) unique pair means re-running
 * the seeder is a no-op.
 */
class PromptsSeeder extends Seeder
{
    public function run(): void
    {
        $prompts = [
            [
                'name' => 'category_classifier',
                'purpose' => 'Classify a civic report into a canonical category (pothole, garbage, streetlight_out, etc.).',
                'provider_code' => 'mock',
                'prompt_text' => "You are the Civic Intelligence Platform classifier. Given the report text and the optional media, return a JSON object with:\n  labels: array of {label, confidence, is_primary}\n  predicted_type: canonical category slug\n  confidence: overall confidence [0,1]\n  recommended_department: department slug\n  severity: one of low|medium|high|critical\n  quality_score, duplicate_score, fraud_score: 0..100\n  summary: one-sentence description",
                'expected_json_schema' => [
                    'type' => 'object',
                    'required' => ['labels', 'predicted_type', 'confidence', 'severity', 'summary'],
                ],
            ],
            [
                'name' => 'severity_estimator',
                'purpose' => 'Estimate the severity of a civic report from text + media.',
                'provider_code' => 'mock',
                'prompt_text' => 'Given the report, return a JSON object with severity ∈ {low, medium, high, critical} and a brief rationale.',
                'expected_json_schema' => [
                    'type' => 'object',
                    'required' => ['severity'],
                ],
            ],
            [
                'name' => 'ai_labeller',
                'purpose' => 'Multi-label classification for routing rules (the M7 routing DSL reads the primary label).',
                'provider_code' => 'mock',
                'prompt_text' => 'Return a JSON object with a `labels` array. Exactly one label MUST have is_primary=true. The primary label is the canonical category the routing engine matches against.',
                'expected_json_schema' => [
                    'type' => 'object',
                    'required' => ['labels'],
                ],
            ],
        ];

        $now = now();

        foreach ($prompts as $p) {
            $existing = PromptVersion::query()
                ->where('name', $p['name'])
                ->where('version', 1)
                ->first();

            if ($existing !== null) {
                continue;
            }

            PromptVersion::query()->create([
                'id' => (string) Str::uuid(),
                'name' => $p['name'],
                'version' => 1,
                'purpose' => $p['purpose'],
                'provider_code' => $p['provider_code'],
                'prompt_text' => $p['prompt_text'],
                'expected_json_schema' => $p['expected_json_schema'],
                'status' => PromptVersion::STATUS_APPROVED,
                'approved_by' => null,
                'approved_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
