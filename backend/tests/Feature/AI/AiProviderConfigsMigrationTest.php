<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('creates the ai_provider_configs table with the expected columns', function (): void {
    expect(Schema::hasTable('ai_provider_configs'))->toBeTrue();

    foreach ([
        'id', 'code', 'driver', 'name', 'base_url', 'auth_type',
        'extra_headers', 'credentials', 'model', 'temperature', 'timeout_ms',
        'retry_count', 'is_fallback', 'priority', 'active',
        'created_at', 'updated_at',
    ] as $col) {
        expect(Schema::hasColumn('ai_provider_configs', $col))->toBeTrue("missing column: {$col}");
    }
});

it('enforces a unique code on ai_provider_configs', function (): void {
    $code = strtolower(Str::random(8));

    DB::table('ai_provider_configs')->insert([
        'id' => (string) Str::uuid(),
        'code' => $code,
        'name' => 'A',
        'base_url' => 'https://example.com',
        'auth_type' => 'bearer',
        'model' => 'gpt-4o',
        'temperature' => 0.20,
        'timeout_ms' => 30000,
        'retry_count' => 2,
        'is_fallback' => false,
        'priority' => 100,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    expect(fn () => DB::table('ai_provider_configs')->insert([
        'id' => (string) Str::uuid(),
        'code' => $code,
        'name' => 'B',
        'base_url' => 'https://example.com',
        'auth_type' => 'bearer',
        'model' => 'gpt-4o',
        'temperature' => 0.20,
        'timeout_ms' => 30000,
        'retry_count' => 2,
        'is_fallback' => false,
        'priority' => 100,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});

it('accepts a NULL credentials value (mock/none-auth providers need no secret)', function (): void {
    $id = (string) Str::uuid();
    DB::table('ai_provider_configs')->insert([
        'id' => $id,
        'code' => strtolower(Str::random(8)),
        'driver' => 'mock',
        'name' => 'No key',
        'base_url' => 'https://example.com',
        'auth_type' => 'none',
        'credentials' => null,
        'model' => 'local',
        'temperature' => 0.0,
        'timeout_ms' => 5000,
        'retry_count' => 0,
        'is_fallback' => false,
        'priority' => 100,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    expect(DB::table('ai_provider_configs')->where('id', $id)->whereNull('credentials')->exists())->toBeTrue();
});

it('has the is_fallback, active, and priority indexes for the resolve query', function (): void {
    $indexes = collect(Schema::getIndexes('ai_provider_configs'));

    foreach (['is_fallback', 'active', 'priority'] as $col) {
        $idx = $indexes->first(fn ($i) => in_array($col, $i['columns'], true));
        expect($idx)->not->toBeNull("missing index on {$col}");
    }
});
