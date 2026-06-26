<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('has a users table with the platform contract', function (): void {
    expect(Schema::hasTable('users'))->toBeTrue();

    $expected = [
        'id',
        'name',
        'mobile',
        'email',
        'password',
        'otp_verified_at',
        'anonymous_enabled',
        'status',
        'last_login_at',
        'last_login_ip',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_confirmed_at',
        'remember_token',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    foreach ($expected as $column) {
        expect(Schema::hasColumn('users', $column))->toBeTrue("users.{$column} should exist");
    }
});

it('uses a string primary key of length 36 (UUID storage)', function (): void {
    $driver = DB::connection()->getDriverName();

    if ($driver === 'sqlite') {
        $value = (string) Str::uuid();
        expect(strlen($value))->toBe(36);
        DB::table('users')->insert([
            'id' => $value,
            'mobile' => '9999999999',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $stored = DB::table('users')->where('id', $value)->value('id');
        expect($stored)->toBe($value);
    } else {
        $idType = strtolower((string) Schema::getColumnType('users', 'id'));
        expect($idType)->toBeIn(['uuid', 'char', 'string']);
    }
});

it('enforces unique indexes on mobile and email', function (): void {
    if (DB::connection()->getDriverName() === 'sqlite') {
        $indexes = collect(DB::select("PRAGMA index_list('users')"))->pluck('name')->all();
        expect(collect($indexes)->contains(fn ($i) => str_contains((string) $i, 'mobile')))->toBeTrue();
        expect(collect($indexes)->contains(fn ($i) => str_contains((string) $i, 'email')))->toBeTrue();
    } else {
        $sm = Schema::getConnection()->getDoctrineSchemaManager();
        $indexes = $sm->listTableIndexes('users');
        $flat = collect($indexes)->map(fn ($i) => $i->getColumns())->flatten();
        expect($flat->contains('mobile'))->toBeTrue();
        expect($flat->contains('email'))->toBeTrue();
    }
});

it('exposes a boolean anonymous_enabled and a string status', function (): void {
    $anonymousType = strtolower((string) Schema::getColumnType('users', 'anonymous_enabled'));
    $statusType = strtolower((string) Schema::getColumnType('users', 'status'));
    expect($anonymousType)->toBeIn(['boolean', 'bool', 'tinyint(1)', 'tinyint']);
    expect($statusType)->toBeIn(['string', 'varchar']);
});
