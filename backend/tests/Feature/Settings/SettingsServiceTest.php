<?php

declare(strict_types=1);

use App\Modules\Settings\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Settings\Services\SettingsService;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);


it('returns the default when the key is missing', function (): void {
    Cache::flush();
    $service = new SettingsService;
    expect($service->get('does.not.exist', 'fallback'))->toBe('fallback')
        ->and($service->get('does.not.exist'))->toBeNull();
});

it('stores a value and reads it back', function (): void {
    Cache::flush();
    $service = new SettingsService;
    $service->set('greeting', 'hello');
    expect($service->get('greeting'))->toBe('hello');
});

it('writes a value that survives a process restart (re-read from DB)', function (): void {
    Cache::flush();
    (new SettingsService)->set('persistent.key', 'persistent-value', 'string');

    // Drop the cache and re-read; the value must still be in the DB.
    Cache::flush();
    expect((new SettingsService)->get('persistent.key'))->toBe('persistent-value');
});

it('caches reads — a second get() does not re-query the DB', function (): void {
    Cache::flush();
    $service = new SettingsService;
    $service->set('cached.key', 'cached-value');

    // Warm the cache.
    $service->get('cached.key');

    // Mutate the DB row directly without touching the service —
    // a stale cache must keep returning the old value.
    Setting::query()->where('key', 'cached.key')->update(['value' => 'new-value-direct']);

    expect($service->get('cached.key'))->toBe('cached-value');
});

it('invalidates the cache on set()', function (): void {
    Cache::flush();
    $service = new SettingsService;
    $service->set('flap.key', 'v1');
    expect($service->get('flap.key'))->toBe('v1');

    $service->set('flap.key', 'v2');
    expect($service->get('flap.key'))->toBe('v2');
});

it('invalidates the cache on forget() and soft-deletes the row', function (): void {
    Cache::flush();
    $service = new SettingsService;
    $service->set('forgettable.key', 'value');
    expect($service->get('forgettable.key'))->toBe('value');

    $service->forget('forgettable.key');
    expect($service->get('forgettable.key', 'gone'))->toBe('gone');

    $row = Setting::onlyTrashed()->where('key', 'forgettable.key')->first();
    expect($row)->not->toBeNull();
});

it('coerces typed values through the model layer', function (): void {
    Cache::flush();
    $service = new SettingsService;
    $service->set('typed.int', 42, 'int');
    $service->set('typed.bool', true, 'bool');
    $service->set('typed.json', ['k' => 'v'], 'json');

    expect($service->get('typed.int'))->toBe(42)
        ->and($service->get('typed.bool'))->toBeTrue()
        ->and($service->get('typed.json'))->toBe(['k' => 'v']);
});
