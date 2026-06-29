<?php

declare(strict_types=1);

use App\Modules\Settings\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);


it('creates the settings table with the required columns', function (): void {
    $cols = ['id', 'key', 'value', 'type', 'description', 'is_public',
        'created_at', 'updated_at', 'deleted_at'];

    foreach ($cols as $c) {
        expect(Schema::hasColumn('settings', $c))->toBeTrue("settings.{$c} must exist");
    }
    expect(Schema::hasTable('settings'))->toBeTrue();
});

it('enforces a unique index on settings.key', function (): void {
    // Insert two rows with the same `key` via the query builder so
    // we exercise the unique index (Setting::set is upsert and
    // does not throw on duplicate by design).
    Setting::query()->create(['key' => 'foo.bar', 'value' => 'baz', 'type' => 'string']);

    expect(fn () => Setting::query()->create(['key' => 'foo.bar', 'value' => 'qux', 'type' => 'string']))
        ->toThrow(QueryException::class);
});

it('roundtrips a string value through Setting::set / Setting::get', function (): void {
    Setting::set('greeting', 'hello world');
    expect(Setting::get('greeting'))->toBe('hello world');
});

it('roundtrips an int value as a real int', function (): void {
    Setting::set('uploads.max_size_mb', 25, 'int');
    expect(Setting::get('uploads.max_size_mb'))->toBe(25);
});

it('roundtrips a bool value as a real bool', function (): void {
    Setting::set('reports.allow_anonymous', true, 'bool');
    expect(Setting::get('reports.allow_anonymous'))->toBeTrue();

    Setting::set('reports.allow_anonymous', false, 'bool');
    expect(Setting::get('reports.allow_anonymous'))->toBeFalse();
});

it('roundtrips a JSON array value', function (): void {
    $payload = ['enabled' => true, 'max_attempts' => 5];
    Setting::set('otp.policy', $payload, 'json');
    expect(Setting::get('otp.policy'))->toBe($payload);
});

it('roundtrips a datetime value as a Carbon instance', function (): void {
    $now = Carbon::parse('2026-06-27 01:00:00');
    Setting::set('system.maintenance_window_start', $now->toIso8601String(), 'datetime');
    expect(Setting::get('system.maintenance_window_start'))->toBeInstanceOf(Carbon::class)
        ->and(Setting::get('system.maintenance_window_start')->equalTo($now))->toBeTrue();
});

it('returns the provided default when the key is missing', function (): void {
    expect(Setting::get('does.not.exist', 'fallback'))->toBe('fallback')
        ->and(Setting::get('does.not.exist'))->toBeNull();
});

it('soft-deletes a setting and hides it from get()', function (): void {
    Setting::set('temp.key', 'value');
    expect(Setting::get('temp.key'))->toBe('value');

    Setting::query()->where('key', 'temp.key')->delete();
    expect(Setting::get('temp.key', 'gone'))->toBe('gone');
});

it('uses the settings table and UUID primary key', function (): void {
    $m = new Setting;
    expect($m->getTable())->toBe('settings')
        ->and($m->getKeyName())->toBe('id')
        ->and($m->getKeyType())->toBe('string');
});

it('casts the value column to an array', function (): void {
    $row = Setting::set('casts.test', ['a' => 1]);
    expect($row->value)->toBe(['a' => 1]);
});
