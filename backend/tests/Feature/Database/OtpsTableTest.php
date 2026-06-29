<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


/**
 * Roundtrip test for the otps migration introduced in T-M2-004.
 *
 * Per docs/04 §6 (user domain) and docs/11 §6 (citizen OTP auth) and §21
 * (5 OTPs/hour), the otps table must hold the requested columns with the
 * right types, nullability, and indexes.
 */
it('creates the otps table with the expected columns', function (): void {
    expect(Schema::hasTable('otps'))->toBeTrue();

    $expected = [
        'id' => 'string',
        'mobile' => 'string',
        'code_hash' => 'string',
        'expires_at' => 'datetime',
        'consumed_at' => 'datetime',
        'attempts' => 'integer',
        'ip' => 'string',
        'user_agent' => 'string',
        'created_at' => 'datetime',
    ];

    foreach ($expected as $column => $type) {
        expect(Schema::hasColumn('otps', $column))->toBeTrue("missing column: {$column}");
    }
});

it('makes id a uuid primary key', function (): void {
    $pk = collect(DB::select('PRAGMA table_info(otps)'))
        ->first(fn ($col) => isset($col->pk) && (int) $col->pk === 1);
    expect($pk)->not->toBeNull();
    expect(strtolower($pk->name))->toBe('id');
    expect(strtolower($pk->type))->toBeIn(['string', 'varchar']);
});

it('does not have updated_at or deleted_at — otps are immutable', function (): void {
    expect(Schema::hasColumn('otps', 'updated_at'))->toBeFalse();
    expect(Schema::hasColumn('otps', 'deleted_at'))->toBeFalse();
});

it('has an index on mobile + expires_at and a standalone index on expires_at', function (): void {
    $indexes = collect(DB::select('PRAGMA index_list(otps)'))->pluck('name')->all();
    // SQLite names indexes after the first indexed column.
    expect($indexes)->toContain('otps_mobile_expires_at_index')
        ->and($indexes)->toContain('otps_expires_at_index');
});

it('roundtrips a row insert + read', function (): void {
    $id = (string) Str::uuid();
    DB::table('otps')->insert([
        'id' => $id,
        'mobile' => '9876543210',
        'code_hash' => password_hash('123456', PASSWORD_BCRYPT),
        'expires_at' => now()->addMinutes(5),
        'consumed_at' => null,
        'attempts' => 0,
        'ip' => '10.0.0.1',
        'user_agent' => 'Pest/Test',
        'created_at' => now(),
    ]);

    $row = DB::table('otps')->where('id', $id)->first();
    expect($row)->not->toBeNull()
        ->and($row->mobile)->toBe('9876543210')
        ->and((int) $row->attempts)->toBe(0)
        ->and($row->consumed_at)->toBeNull();
});

it('rejects rows with a missing required field (mobile)', function (): void {
    DB::table('otps')->insert([
        'id' => (string) Str::uuid(),
        'mobile' => null,
        'code_hash' => 'x',
        'expires_at' => now()->addMinutes(5),
    ]);
})->throws(QueryException::class);
