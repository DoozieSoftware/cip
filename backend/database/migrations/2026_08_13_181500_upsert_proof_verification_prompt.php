<?php

declare(strict_types=1);

use App\Modules\AI\Models\PromptVersion;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $prompt = <<<'PROMPT'
You are the Civic Intelligence Platform proof-of-completion reviewer. You compare two images for the same civic report:

IMAGE 1 is the citizen's BEFORE evidence.
IMAGE 2 is the department officer's AFTER proof.

The report title, description, type, address, and GPS distance are context. Use them only to judge whether the AFTER proof plausibly documents the same issue being fixed. Do not invent facts not visible in the images.

Review in this order:
1. Describe the BEFORE image briefly.
2. Describe the AFTER image briefly.
3. Decide whether the AFTER image appears to be from the same place or same civic issue, allowing different angles, zoom, lighting, and time of day.
4. Decide whether the AFTER image plausibly shows completion or field action for the original issue.
5. Weigh GPS strongly: if the proof GPS is far from the report location, mark the result as mismatch even if the image looks plausible.
6. Detect obvious wrong uploads: pets, toys, indoor selfies, unrelated documents, screenshots, reused BEFORE image, or non-civic photos.

Return JSON only. Include the common classifier compatibility fields and the proof fields below:

Common fields:
- labels: array with one primary label, e.g. [{"label":"proof_verification","confidence":0.7,"is_primary":true}]
- predicted_type: "proof_verification"
- confidence: 0..1 overall confidence in your proof decision
- recommended_department: empty string
- severity: "low"
- quality_score: 0..100
- duplicate_score: 0
- fraud_score: 0..100
- summary: one short plain-language explanation for officers
- claim_matches_evidence: boolean
- consistency_score: 0..100 scene/issue match score between BEFORE and AFTER
- mismatch_reason: short reason when proof is wrong or unrelated; empty string otherwise
- synthetic_score: 0..1
- license_plate: null unless a relevant plate is clearly readable
- plate_confidence: 0..1

Proof fields:
- proof_matches_report: boolean
- scene_match_confidence: 0..100
- resolution_confidence: 0..100
- location_risk: "low", "medium", or "high"
- needs_human_review: boolean
- perspective_note: one sentence explaining whether different camera angles could still be acceptable
PROMPT;

        PromptVersion::query()
            ->where('name', 'proof_verification')
            ->where('status', PromptVersion::STATUS_APPROVED)
            ->update(['status' => PromptVersion::STATUS_DEPRECATED, 'updated_at' => $now]);

        $row = PromptVersion::query()->firstOrNew([
            'name' => 'proof_verification',
            'version' => 1,
        ]);

        if (! $row->exists) {
            $row->id = (string) Str::uuid();
            $row->created_at = $now;
        }

        $row->fill([
            'purpose' => 'Compare citizen before evidence with officer after-proof using a separate proof-review prompt.',
            'provider_code' => 'vertex-gemini-flash',
            'prompt_text' => $prompt,
            'expected_json_schema' => [
                'type' => 'object',
                'required' => [
                    'labels',
                    'predicted_type',
                    'confidence',
                    'summary',
                    'claim_matches_evidence',
                    'consistency_score',
                    'proof_matches_report',
                    'scene_match_confidence',
                    'resolution_confidence',
                    'location_risk',
                    'needs_human_review',
                    'perspective_note',
                ],
            ],
            'status' => PromptVersion::STATUS_APPROVED,
            'approved_by' => null,
            'approved_at' => $now,
            'updated_at' => $now,
        ])->save();
    }

    public function down(): void
    {
        DB::table('prompt_versions')
            ->where('name', 'proof_verification')
            ->where('version', 1)
            ->delete();
    }
};
