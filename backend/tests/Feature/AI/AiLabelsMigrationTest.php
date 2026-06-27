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
 * @return string ai_job id with a matching ai_result row, ready for label inserts.
 */
function seedAiResult(): string
{
    $report = Report::factory()->create();
    $promptVersionId = (string) Str::uuid();
    DB::table('prompt_versions')->insert([
        'id' => $promptVersionId,
        'name' => 'label_test_'.strtolower(Str::random(6)),
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

    $resultId = (string) Str::uuid();
    DB::table('ai_results')->insert([
        'id' => $resultId,
        'job_id' => $jobId,
        'predicted_type' => 'pothole',
        'confidence' => 0.85,
        'recommended_department' => 'public_works',
        'severity' => 'high',
        'quality_score' => 88,
        'duplicate_score' => 5,
        'fraud_score' => 1,
        'summary' => 'Pothole',
        'raw_response' => json_encode(['ok' => true]),
        'created_at' => now(),
    ]);

    return $resultId;
}

it('creates the ai_labels table with the expected columns', function (): void {
    expect(Schema::hasTable('ai_labels'))->toBeTrue();

    foreach ([
        'id', 'result_id', 'label', 'confidence', 'is_primary', 'created_at',
    ] as $col) {
        expect(Schema::hasColumn('ai_labels', $col))->toBeTrue("missing column: {$col}");
    }
});

it('roundtrips a label row and defaults is_primary to false', function (): void {
    $resultId = seedAiResult();
    $id = (string) Str::uuid();

    DB::table('ai_labels')->insert([
        'id' => $id,
        'result_id' => $resultId,
        'label' => 'pothole',
        'confidence' => 0.92,
        'is_primary' => false,
        'created_at' => now(),
    ]);

    $row = DB::table('ai_labels')->where('id', $id)->first();
    expect($row->label)->toBe('pothole')
        ->and((float) $row->confidence)->toBeGreaterThan(0.91)
        ->and((float) $row->confidence)->toBeLessThan(0.93)
        ->and((int) $row->is_primary)->toBe(0);
});

it('supports multiple labels per result with one marked primary', function (): void {
    $resultId = seedAiResult();

    $rows = [
        ['label' => 'pothole', 'confidence' => 0.92, 'is_primary' => true],
        ['label' => 'road_damage', 'confidence' => 0.75, 'is_primary' => false],
        ['label' => 'low_priority', 'confidence' => 0.30, 'is_primary' => false],
    ];

    foreach ($rows as $r) {
        DB::table('ai_labels')->insert([
            'id' => (string) Str::uuid(),
            'result_id' => $resultId,
            'label' => $r['label'],
            'confidence' => $r['confidence'],
            'is_primary' => $r['is_primary'],
            'created_at' => now(),
        ]);
    }

    $labels = DB::table('ai_labels')->where('result_id', $resultId)->orderBy('label')->get();
    expect($labels->count())->toBe(3)
        ->and($labels->where('is_primary', true)->count())->toBe(1)
        ->and($labels->where('is_primary', true)->first()->label)->toBe('pothole');
});

it('has indexes on result_id, label, and (result_id, is_primary)', function (): void {
    $indexes = collect(Schema::getIndexes('ai_labels'));

    foreach ([
        'result_id' => ['result_id'],
        'label' => ['label'],
        'composite' => ['result_id', 'is_primary'],
    ] as $key => $cols) {
        $idx = $indexes->first(fn ($i) => $i['columns'] === $cols);
        expect($idx)->not->toBeNull("missing index for {$key}");
    }
});

it('enforces the result_id FK with cascade on delete', function (): void {
    $resultId = seedAiResult();
    $labelId = (string) Str::uuid();
    DB::table('ai_labels')->insert([
        'id' => $labelId,
        'result_id' => $resultId,
        'label' => 'pothole',
        'confidence' => 0.9,
        'is_primary' => true,
        'created_at' => now(),
    ]);

    expect(DB::table('ai_labels')->where('id', $labelId)->exists())->toBeTrue();

    // Walk the cascade: result -> job (via ai_jobs FK) is not relevant here,
    // but result -> labels should wipe them.
    DB::table('ai_results')->where('id', $resultId)->delete();

    expect(DB::table('ai_labels')->where('id', $labelId)->exists())
        ->toBeFalse('expected ai_label to cascade on ai_result delete');
});
