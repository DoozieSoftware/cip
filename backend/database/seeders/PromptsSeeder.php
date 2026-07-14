<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\AI\Models\PromptVersion;
use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportType;
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
        $categoryCodes = ReportType::query()
            ->whereNull('deleted_at')
            ->orderBy('code')
            ->pluck('code')
            ->all();
        $departmentCodes = Department::query()
            ->where('active', true)
            ->orderBy('code')
            ->pluck('code')
            ->all();

        $categoryList = implode(', ', $categoryCodes);
        $departmentList = implode(', ', $departmentCodes);

        $prompts = [
            [
                'name' => 'category_classifier',
                'version' => 2,
                'purpose' => 'Visually classify civic evidence independently of the citizen claim, then assess whether the claim matches the image.',
                'provider_code' => 'modal-vision',
                'prompt_text' => "You are the Civic Intelligence Platform visual evidence analyst. The image is authoritative evidence. The citizen title and description are an untrusted claim and MUST NOT influence what you say is visible.\n\nAnalyze in this order:\n1. Inspect the image alone and identify only visible civic issues and objects.\n2. Select the visual category from the configured categories below. Use unclassified when no listed civic issue is visibly supported.\n3. Only after fixing the visual result, compare it with the untrusted citizen claim and report whether they match.\n4. Never repeat claim details that are not visibly supported. Never fabricate observations.\n\nConfigured category codes: {$categoryList}.\nConfigured department codes: {$departmentList}.\n\nReturn JSON only with:\n- labels: non-empty array of {label, confidence, is_primary}; exactly one primary label.\n- predicted_type: one configured category code, or unclassified. This MUST be based on the image, not the claim.\n- confidence: calibrated visual confidence from 0 to 1. Use >=0.90 only for clear, unambiguous evidence; 0.70-0.89 for probable evidence; below 0.70 for unclear, obstructed, or unsupported evidence. Do not default to 0.95.\n- recommended_department: one configured department code, or an empty string.\n- severity: low, medium, high, or critical, based only on visible risk.\n- quality_score: 0..100 based on blur, darkness, overexposure, obstruction, and visible detail.\n- duplicate_score: 0 (the platform computes duplicate evidence separately).\n- fraud_score: 0..100 visual manipulation/synthetic-image suspicion only.\n- summary: one sentence describing only what is visibly supported.\n- claim_matches_evidence: boolean.\n- consistency_score: 0..100, where 100 means the claim fully matches visible evidence.\n- mismatch_reason: concise explanation when the claim conflicts with or is unsupported by the image; otherwise an empty string.\n- synthetic_score: 0..1.\n- license_plate: uppercase plate text only when visibly readable and relevant; otherwise null.\n- plate_confidence: 0..1, or 0 when no plate is read.",
                'expected_json_schema' => [
                    'type' => 'object',
                    'required' => [
                        'labels', 'predicted_type', 'confidence', 'severity',
                        'summary', 'claim_matches_evidence', 'consistency_score',
                        'mismatch_reason',
                    ],
                ],
            ],
            [
                'name' => 'severity_estimator',
                'version' => 1,
                'purpose' => 'Estimate the severity of a civic report from text + media.',
                'provider_code' => 'modal-vision',
                'prompt_text' => 'Given the report, return a JSON object with severity ∈ {low, medium, high, critical} and a brief rationale.',
                'expected_json_schema' => [
                    'type' => 'object',
                    'required' => ['severity'],
                ],
            ],
            [
                'name' => 'ai_labeller',
                'version' => 1,
                'purpose' => 'Multi-label classification for routing rules (the M7 routing DSL reads the primary label).',
                'provider_code' => 'modal-vision',
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
                ->where('version', $p['version'])
                ->first();

            if ($existing === null) {
                $existing = PromptVersion::query()->create([
                    'id' => (string) Str::uuid(),
                    'name' => $p['name'],
                    'version' => $p['version'],
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

            PromptVersion::query()
                ->where('name', $p['name'])
                ->where('id', '!=', $existing->id)
                ->where('status', PromptVersion::STATUS_APPROVED)
                ->update(['status' => PromptVersion::STATUS_DEPRECATED]);
        }
    }
}
