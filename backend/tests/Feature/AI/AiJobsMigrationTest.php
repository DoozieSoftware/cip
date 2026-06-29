<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

use Illuminate\Support\Str;

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // Master-data seeders are required because the reports table FKs reference
    // report_types, report_statuses, and report_priorities (all restrictOnDelete).
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('creates the ai_jobs table with the expected columns', function (): void {
    expect(Schema::hasTable('ai_jobs'))->toBeTrue();

    foreach ([
        'id', 'report_id', 'prompt_version_id', 'provider_code', 'model',
        'status', 'requested_at', 'started_at', 'completed_at',
        'processing_time_ms', 'error_code', 'retry_count',
        'tokens_in', 'tokens_out', 'cost_cents',
        'created_at', 'updated_at',
    ] as $col) {
        expect(Schema::hasColumn('ai_jobs', $col))->toBeTrue("missing column: {$col}");
    }
});

it('accepts every status enum value the orchestrator can write', function (): void {
    $report = Report::factory()->create();
    $promptVersionId = (string) Str::uuid();
    DB::table('prompt_versions')->insert([
        'id' => $promptVersionId,
        'name' => 'enum_test_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'draft',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $values = ['queued', 'running', 'succeeded', 'failed', 'timeout'];

    foreach ($values as $status) {
        $id = (string) Str::uuid();
        DB::table('ai_jobs')->insert([
            'id' => $id,
            'report_id' => $report->id,
            'prompt_version_id' => $promptVersionId,
            'provider_code' => 'openai',
            'model' => 'gpt-4o',
            'status' => $status,
            'requested_at' => now(),
            'retry_count' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        expect(DB::table('ai_jobs')->where('id', $id)->value('status'))->toBe($status);
    }
});

it('has indexes on status, report_id, (report_id, status), and provider_code', function (): void {
    $indexes = collect(Schema::getIndexes('ai_jobs'));

    $status = $indexes->first(fn ($i) => $i['columns'] === ['status']);
    expect($status)->not->toBeNull('missing index on status');

    $report = $indexes->first(fn ($i) => $i['columns'] === ['report_id']);
    expect($report)->not->toBeNull('missing index on report_id');

    $composite = $indexes->first(fn ($i) => $i['columns'] === ['report_id', 'status']);
    expect($composite)->not->toBeNull('missing composite index on (report_id, status)');

    $provider = $indexes->first(fn ($i) => $i['columns'] === ['provider_code']);
    expect($provider)->not->toBeNull('missing index on provider_code');
});

it('defaults retry_count to 0 and accepts increments for the retry path', function (): void {
    $report = Report::factory()->create();
    $promptVersionId = (string) Str::uuid();
    DB::table('prompt_versions')->insert([
        'id' => $promptVersionId,
        'name' => 'retry_test_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'draft',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $id = (string) Str::uuid();
    DB::table('ai_jobs')->insert([
        'id' => $id,
        'report_id' => $report->id,
        'prompt_version_id' => $promptVersionId,
        'provider_code' => 'openai',
        'model' => 'gpt-4o',
        'status' => 'queued',
        'requested_at' => now(),
        'retry_count' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    expect(DB::table('ai_jobs')->where('id', $id)->value('retry_count'))->toBe(0);

    DB::table('ai_jobs')->where('id', $id)->update(['retry_count' => 3]);
    expect(DB::table('ai_jobs')->where('id', $id)->value('retry_count'))->toBe(3);
});

it('preserves null processing time and cost columns for the queued state', function (): void {
    $report = Report::factory()->create();
    $promptVersionId = (string) Str::uuid();
    DB::table('prompt_versions')->insert([
        'id' => $promptVersionId,
        'name' => 'null_test_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'draft',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $id = (string) Str::uuid();
    DB::table('ai_jobs')->insert([
        'id' => $id,
        'report_id' => $report->id,
        'prompt_version_id' => $promptVersionId,
        'provider_code' => 'openai',
        'model' => 'gpt-4o',
        'status' => 'queued',
        'requested_at' => now(),
        'retry_count' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $row = DB::table('ai_jobs')->where('id', $id)->first();

    expect($row->started_at)->toBeNull()
        ->and($row->completed_at)->toBeNull()
        ->and($row->processing_time_ms)->toBeNull()
        ->and($row->error_code)->toBeNull()
        ->and($row->tokens_in)->toBeNull()
        ->and($row->tokens_out)->toBeNull()
        ->and($row->cost_cents)->toBeNull();
});

it('enforces cascade on the report_id FK and restrict on the prompt_version_id FK', function (): void {
    $report = Report::factory()->create();
    $promptVersionId = (string) Str::uuid();

    DB::table('prompt_versions')->insert([
        'id' => $promptVersionId,
        'name' => 'fk_test_'.strtolower(Str::random(6)),
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
        'status' => 'queued',
        'requested_at' => now(),
        'retry_count' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    expect(DB::table('ai_jobs')->where('id', $jobId)->exists())->toBeTrue();

    // Cascade: deleting the report should remove the ai_job row.
    DB::table('reports')->where('id', $report->id)->delete();
    expect(DB::table('ai_jobs')->where('id', $jobId)->exists())->toBeFalse('expected ai_job to cascade on report delete');

    // Restrict: deleting a prompt_version referenced by an ai_job must fail.
    $report2 = Report::factory()->create();
    $jobId2 = (string) Str::uuid();
    DB::table('ai_jobs')->insert([
        'id' => $jobId2,
        'report_id' => $report2->id,
        'prompt_version_id' => $promptVersionId,
        'provider_code' => 'openai',
        'model' => 'gpt-4o',
        'status' => 'queued',
        'requested_at' => now(),
        'retry_count' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    expect(fn () => DB::table('prompt_versions')->where('id', $promptVersionId)->delete())
        ->toThrow(QueryException::class);
});
