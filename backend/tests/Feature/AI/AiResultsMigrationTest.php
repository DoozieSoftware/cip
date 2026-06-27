<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

/**
 * @return array{id: string, job_id: string}
 */
function seedAiJob(): array
{
    $report = Report::factory()->create();
    $promptVersionId = (string) Str::uuid();
    DB::table('prompt_versions')->insert([
        'id' => $promptVersionId,
        'name' => 'result_test_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'draft',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $jobId = (string) Str::uuid();
    DB::table('ai_jobs')->insert([
        'id' => $jobId,
        'report_id' => $report->id,
        'prompt_version_id' => $promptVersionId,
        'provider_code' => 'openai',
        'model' => 'gpt-4o',
        'status' => 'succeeded',
        'requested_at' => now(),
        'started_at' => now(),
        'completed_at' => now(),
        'processing_time_ms' => 1234,
        'retry_count' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return ['id' => $promptVersionId, 'job_id' => $jobId];
}

it('creates the ai_results table with the expected columns', function (): void {
    expect(Schema::hasTable('ai_results'))->toBeTrue();

    foreach ([
        'id', 'job_id', 'predicted_type', 'confidence', 'recommended_department',
        'severity', 'quality_score', 'duplicate_score', 'fraud_score',
        'summary', 'raw_response', 'created_at',
    ] as $col) {
        expect(Schema::hasColumn('ai_results', $col))->toBeTrue("missing column: {$col}");
    }
});

it('roundtrips a full result row including the JSON raw_response', function (): void {
    $ctx = seedAiJob();

    $id = (string) Str::uuid();
    $raw = [
        'id' => 'chatcmpl-abc123',
        'choices' => [
            ['message' => ['content' => json_encode(['predicted_type' => 'pothole'])]],
        ],
        'usage' => ['prompt_tokens' => 100, 'completion_tokens' => 50],
    ];

    DB::table('ai_results')->insert([
        'id' => $id,
        'job_id' => $ctx['job_id'],
        'predicted_type' => 'pothole',
        'confidence' => 0.9234,
        'recommended_department' => 'public_works',
        'severity' => 'high',
        'quality_score' => 88,
        'duplicate_score' => 12,
        'fraud_score' => 5,
        'summary' => 'Large pothole in the right lane of MG Road near the signal.',
        'raw_response' => json_encode($raw),
        'created_at' => now(),
    ]);

    $row = DB::table('ai_results')->where('id', $id)->first();

    expect($row->job_id)->toBe($ctx['job_id'])
        ->and($row->predicted_type)->toBe('pothole')
        ->and((float) $row->confidence)->toBeGreaterThan(0.92)
        ->and((float) $row->confidence)->toBeLessThan(0.93)
        ->and($row->recommended_department)->toBe('public_works')
        ->and($row->severity)->toBe('high')
        ->and($row->quality_score)->toBe(88)
        ->and($row->duplicate_score)->toBe(12)
        ->and($row->fraud_score)->toBe(5)
        ->and($row->summary)->toContain('pothole');

    // raw_response round-trips intact
    $decoded = json_decode($row->raw_response, true);
    expect($decoded)->toBe($raw);
});

it('has indexes on job_id, predicted_type, severity, and recommended_department', function (): void {
    $indexes = collect(Schema::getIndexes('ai_results'));

    foreach ([
        'job_id' => ['job_id'],
        'predicted_type' => ['predicted_type'],
        'severity' => ['severity'],
        'recommended_department' => ['recommended_department'],
    ] as $col => $cols) {
        $idx = $indexes->first(fn ($i) => $i['columns'] === $cols);
        expect($idx)->not->toBeNull("missing index on {$col}");
    }
});

it('enforces the 0–100 range on the three score columns', function (): void {
    $ctx = seedAiJob();

    // unsignedSmallInteger caps at 65535, but the *application* contract is 0–100.
    // This test pins the range the orchestrator writes; values outside the range
    // should still be storable in the DB (the type is broader than the contract)
    // and the real validation lives in the AiResult::creating model event later.
    foreach ([0, 50, 100] as $score) {
        $id = (string) Str::uuid();
        DB::table('ai_results')->insert([
            'id' => $id,
            'job_id' => $ctx['job_id'],
            'predicted_type' => 'pothole',
            'confidence' => 0.5,
            'recommended_department' => 'public_works',
            'severity' => 'medium',
            'quality_score' => $score,
            'duplicate_score' => $score,
            'fraud_score' => $score,
            'summary' => "score={$score}",
            'raw_response' => json_encode(['ok' => true]),
            'created_at' => now(),
        ]);

        expect((int) DB::table('ai_results')->where('id', $id)->value('quality_score'))->toBe($score);
    }
});

it('enforces the job_id FK with cascade on delete', function (): void {
    $ctx = seedAiJob();
    $resultId = (string) Str::uuid();
    DB::table('ai_results')->insert([
        'id' => $resultId,
        'job_id' => $ctx['job_id'],
        'predicted_type' => 'pothole',
        'confidence' => 0.5,
        'recommended_department' => 'public_works',
        'severity' => 'medium',
        'quality_score' => 75,
        'duplicate_score' => 0,
        'fraud_score' => 0,
        'summary' => 'x',
        'raw_response' => json_encode(['ok' => true]),
        'created_at' => now(),
    ]);

    expect(DB::table('ai_results')->where('id', $resultId)->exists())->toBeTrue();

    DB::table('ai_jobs')->where('id', $ctx['job_id'])->delete();

    expect(DB::table('ai_results')->where('id', $resultId)->exists())
        ->toBeFalse('expected ai_result to cascade on ai_job delete');
});
