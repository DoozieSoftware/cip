<?php

declare(strict_types=1);

use App\Modules\Settings\Models\Setting;
use App\Modules\Settings\Services\SettingsService;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    Cache::flush();
});

if (! function_exists('makeSuperAdmin')) {
    function makeSuperAdmin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('super_admin');

        return $user;
    }
}

it('rejects unauthenticated callers with 401', function (): void {
    $this->getJson('/api/v1/admin/settings')->assertStatus(401);
});

it('rejects authenticated non-admin callers with 403', function (): void {
    Sanctum::actingAs(User::factory()->create());
    $this->getJson('/api/v1/admin/settings')->assertStatus(403);
});

it('lists settings paginated for super_admin', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    Setting::factory()->count(3)->create();

    $response = $this->getJson('/api/v1/admin/settings?per_page=2');
    $response->assertStatus(200)
        ->assertJsonPath('data', fn ($data) => is_array($data) && count($data) === 2)
        ->assertJsonPath('meta.total', 3);
});

it('filters the listing by a substring of key or description', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    Setting::factory()->create(['key' => 'ai.vision.provider', 'description' => 'vision stack']);
    Setting::factory()->create(['key' => 'mail.driver', 'description' => 'outgoing mail']);

    $this->getJson('/api/v1/admin/settings?q=vision')
        ->assertStatus(200)
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.key', 'ai.vision.provider');
});

it('creates a setting via POST and stores it in the DB', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $response = $this->postJson('/api/v1/admin/settings', [
        'key' => 'ai.vision.provider',
        'value' => 'openai',
        'type' => 'string',
        'description' => 'Vision provider',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.key', 'ai.vision.provider')
        ->assertJsonPath('data.value', 'openai')
        ->assertJsonPath('data.type', 'string')
        ->assertJsonPath('data.description', 'Vision provider');

    expect(Setting::query()->where('key', 'ai.vision.provider')->exists())->toBeTrue();
});

it('rejects a duplicate key on POST with 422', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    Setting::factory()->create(['key' => 'dup.key']);

    $this->postJson('/api/v1/admin/settings', [
        'key' => 'dup.key',
        'value' => 'x',
        'type' => 'string',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['key']);
});

it('rejects an unknown type with 422', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $this->postJson('/api/v1/admin/settings', [
        'key' => 'some.key',
        'value' => 'x',
        'type' => 'binary',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['type']);
});

it('shows a setting by key', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    Setting::factory()->create(['key' => 'show.me']);

    $this->getJson('/api/v1/admin/settings/show.me')
        ->assertStatus(200)
        ->assertJsonPath('data.key', 'show.me');
});

it('returns 404 for an unknown key', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $this->getJson('/api/v1/admin/settings/does.not.exist')
        ->assertStatus(404)
        ->assertJsonPath('code', 'NOT_FOUND');
});

it('updates a setting via PUT and invalidates the cache', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    // Prime the cache.
    $service = new SettingsService;
    $service->set('flap.key', 'v1', 'string');
    $service->get('flap.key');
    expect($service->get('flap.key'))->toBe('v1');

    $this->putJson('/api/v1/admin/settings/flap.key', [
        'value' => 'v2',
        'type' => 'string',
    ])->assertStatus(200)
        ->assertJsonPath('data.value', 'v2');

    // After the write, the next read must come from the DB.
    expect($service->get('flap.key'))->toBe('v2');
});

it('preserves untouched fields on PUT (partial update)', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    Setting::factory()->create([
        'key' => 'partial.key',
        'value' => 'before',
        'type' => 'string',
        'description' => 'keep me',
    ]);

    $this->putJson('/api/v1/admin/settings/partial.key', ['value' => 'after'])
        ->assertStatus(200)
        ->assertJsonPath('data.description', 'keep me')
        ->assertJsonPath('data.value', 'after');
});

it('soft-deletes a setting via DELETE and clears the cache', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    Setting::factory()->create(['key' => 'doomed.key']);

    $this->deleteJson('/api/v1/admin/settings/doomed.key')
        ->assertStatus(200)
        ->assertJsonPath('data.deleted', true);

    expect(Setting::query()->where('key', 'doomed.key')->exists())->toBeFalse();
    expect(Setting::onlyTrashed()->where('key', 'doomed.key')->exists())->toBeTrue();
});
