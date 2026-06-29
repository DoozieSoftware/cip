<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


it('creates the prompt_versions table with the expected columns', function (): void {
    expect(Schema::hasTable('prompt_versions'))->toBeTrue();

    foreach ([
        'id', 'name', 'version', 'purpose', 'provider_code',
        'prompt_text', 'expected_json_schema', 'status',
        'approved_by', 'approved_at', 'created_at', 'updated_at',
    ] as $col) {
        expect(Schema::hasColumn('prompt_versions', $col))->toBeTrue("missing column: {$col}");
    }
});

it('enforces the (name, version) unique pair', function (): void {
    $name = 'category_classifier_'.strtolower(Str::random(6));

    DB::table('prompt_versions')->insert([
        'id' => (string) Str::uuid(),
        'name' => $name,
        'version' => 1,
        'purpose' => 'classify the report',
        'provider_code' => 'openai',
        'prompt_text' => 'You are a classifier...',
        'expected_json_schema' => null,
        'status' => 'draft',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    expect(fn () => DB::table('prompt_versions')->insert([
        'id' => (string) Str::uuid(),
        'name' => $name,
        'version' => 1,
        'purpose' => 'duplicate',
        'provider_code' => 'openai',
        'prompt_text' => 'dup',
        'expected_json_schema' => null,
        'status' => 'draft',
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});

it('accepts the same name with a different version (monotonic per name)', function (): void {
    $name = 'severity_'.strtolower(Str::random(6));

    foreach ([1, 2, 3] as $v) {
        DB::table('prompt_versions')->insert([
            'id' => (string) Str::uuid(),
            'name' => $name,
            'version' => $v,
            'purpose' => null,
            'provider_code' => 'openai',
            'prompt_text' => "v{$v}",
            'expected_json_schema' => null,
            'status' => $v === 3 ? 'approved' : 'draft',
            'approved_by' => $v === 3 ? (string) Str::uuid() : null,
            'approved_at' => $v === 3 ? now() : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    expect(DB::table('prompt_versions')->where('name', $name)->count())->toBe(3)
        ->and(DB::table('prompt_versions')->where('name', $name)->where('status', 'approved')->count())->toBe(1);
});

it('has the (name, status) and provider_code indexes for the resolve query', function (): void {
    $indexes = collect(Schema::getIndexes('prompt_versions'));

    $nameStatus = $indexes->first(fn ($i) => $i['columns'] === ['name', 'status']);
    expect($nameStatus)->not->toBeNull();

    $provider = $indexes->first(fn ($i) => $i['columns'] === ['provider_code']);
    expect($provider)->not->toBeNull();
});

it('the status column stores the three lifecycle values', function (): void {
    $name = 'lc_'.strtolower(Str::random(6));

    foreach (['draft', 'approved', 'deprecated'] as $status) {
        DB::table('prompt_versions')->insert([
            'id' => (string) Str::uuid(),
            'name' => $name,
            'version' => match ($status) {
                'draft' => 1,
                'approved' => 2,
                'deprecated' => 3,
            },
            'purpose' => null,
            'provider_code' => 'openai',
            'prompt_text' => "x {$status}",
            'expected_json_schema' => null,
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    expect(DB::table('prompt_versions')->where('name', $name)->pluck('status')->sort()->values()->all())
        ->toBe(['approved', 'deprecated', 'draft']);
});
