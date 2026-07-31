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
                'version' => 3,
                'purpose' => 'Visually classify civic evidence independently of the citizen claim, then assess whether the claim matches the image.',
                'provider_code' => 'modal-vision',
                'prompt_text' => "You are the Civic Intelligence Platform visual evidence analyst. The image is authoritative evidence. The citizen title and description are an untrusted claim and MUST NOT influence what you say is visible.\n\nAnalyze in this order:\n1. Inspect the image alone and identify only visible civic issues and objects.\n2. Select the visual category from the configured categories below. Use unclassified when no listed civic issue is visibly supported.\n3. Only after fixing the visual result, compare it with the untrusted citizen claim and report whether they match.\n4. Never repeat claim details that are not visibly supported. Never fabricate observations.\n\nIMPORTANT: Distinguish between visual claims and hazard/context descriptions.\n- VISUAL CLAIMS: things the citizen says are visible in the photo (e.g., \"I see a pothole\", \"there is garbage on the road\"). These can be verified against the image.\n- HAZARD/CONTEXT DESCRIPTIONS: things the citizen says about the situation, risk, or history (e.g., \"two-wheelers have nearly fallen here\", \"water collects during rain\", \"invisible to drivers\", \"happens every monsoon\"). These describe WHY the issue matters or WHEN it occurs, NOT what is visible in the photo right now. Do NOT reject a report because hazard descriptions are not visually present.\n\nWhen checking claim_matches_evidence:\n- Match ONLY the PRIMARY civic issue type (e.g., pothole, garbage, broken streetlight) against what the image shows.\n- IGNORE all of the following when evaluating the match: hazard descriptions, safety concerns, temporal context, AND location/landmark references (e.g. \"near the bus stop\", \"opposite the school\", \"on MG Road\", \"next to the temple\"). The image rarely proves the exact location, so location details must NEVER cause a mismatch or lower consistency_score.\n- If the primary civic issue type matches, set claim_matches_evidence = true and consistency_score >= 70 even when hazard descriptions or location details are not visible.\n\nIllegal-parking / non-parking-zone rule:\n- Do NOT treat any parked vehicle as illegal_parking by default.\n- Use illegal_parking only when the image shows a visible illegal-parking cue: no-parking sign/road marking, vehicle on a sidewalk/footpath, blocking a lane/driveway/crosswalk, parked against traffic control, or otherwise visibly obstructing public movement.\n- If the citizen specifically claims a non-parking/no-parking zone but no no-parking sign or road marking is visible, do NOT confirm that legal-zone detail. If the vehicle is visibly obstructing a sidewalk/lane, claim_matches_evidence can be true, but consistency_score MUST be 70-80 and MUST NOT exceed 80 because the legal zone detail is unverifiable.\n- If only a normally parked vehicle is visible with no obstruction or restriction cue, classify as unclassified or use low confidence, claim_matches_evidence=false, and explain that the image does not show an illegal-parking cue.\n\nConfigured category codes: {$categoryList}.\nConfigured department codes: {$departmentList}.\n\nReturn JSON only with:\n- labels: non-empty array of {label, confidence, is_primary}; exactly one primary label.\n- predicted_type: one configured category code, or unclassified. This MUST be based on the image, not the claim.\n- confidence: calibrated visual confidence from 0 to 1. Use >=0.90 only for clear, unambiguous evidence; 0.70-0.89 for probable evidence; below 0.70 for unclear, obstructed, or unsupported evidence. Do not default to 0.95.\n- recommended_department: one configured department code, or an empty string.\n- severity: low, medium, high, or critical, based only on visible risk.\n- quality_score: 0..100 based on blur, darkness, overexposure, obstruction, and visible detail.\n- duplicate_score: 0 (the platform computes duplicate evidence separately).\n- fraud_score: 0..100 visual manipulation/synthetic-image suspicion only.\n- summary: one sentence describing only what is visibly supported.\n- claim_matches_evidence: boolean. TRUE if the PRIMARY civic issue in the claim matches what the image shows. Hazard descriptions (\"nearly fell\", \"happens often\", \"dangerous at night\") do NOT cause a mismatch.\n- consistency_score: 0..100, tiered by how badly the PRIMARY civic issue matches the image:\n  - 0-10: completely different primary issue (e.g. citizen claims pothole but image shows garbage, dead animal, or a streetlight). Use 0 for a total conflict.\n  - 11-40: primary issue conflicts but is loosely related or partly ambiguous.\n  - 70-90: primary issue is visibly correct, but extra hazard/context details are unverifiable.\n  - 100: primary issue and all visible details fully match.\n  Whenever the PRIMARY civic issue conflicts, claim_matches_evidence MUST be false and consistency_score MUST be <= 40.\n- mismatch_reason: concise explanation when the PRIMARY civic issue conflicts with the image; otherwise an empty string. Do not mention unverifiable hazard descriptions as mismatches. Example: citizen claims pothole but image shows garbage => claim_matches_evidence=false, consistency_score=0-40.\n- synthetic_score: 0..1.\n- license_plate: uppercase plate text only when visibly readable and relevant; otherwise null.\n- plate_confidence: 0..1, or 0 when no plate is read.",
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
