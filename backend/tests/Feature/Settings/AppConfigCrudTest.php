<?php

declare(strict_types=1);

use App\Modules\Settings\Models\AppConfig;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

it('rejects unauthenticated callers with 401', function (): void {
    $this->getJson('/api/v1/admin/app-configs')->assertStatus(401);
});

it('rejects authenticated non-admin callers with 403', function (): void {
    Sanctum::actingAs(User::factory()->create());
    $this->getJson('/api/v1/admin/app-configs')->assertStatus(403);
});

it('lists feature flags paginated for super_admin', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    AppConfig::factory()->count(3)->create();

    $response = $this->getJson('/api/v1/admin/app-configs?per_page=2');
    $response->assertStatus(200)
        ->assertJsonPath('data', fn ($data) => is_array($data) && count($data) === 2)
        ->assertJsonPath('meta.total', 3);
});

it('filters the listing by enabled flag and a substring of key', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    AppConfig::factory()->enabled()->create(['key' => 'ai.vision.enabled']);
    AppConfig::factory()->create(['key' => 'mail.driver', 'enabled' => false]);

    $this->getJson('/api/v1/admin/app-configs?enabled=1&q=vision')
        ->assertStatus(200)
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.key', 'ai.vision.enabled');
});

it('creates a feature flag via POST', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $response = $this->postJson('/api/v1/admin/app-configs', [
        'key' => 'ai.vision.enabled',
        'enabled' => true,
        'rollout_percentage' => 25,
        'cohort' => [['role' => 'super_admin']],
        'description' => 'Vision stack rollout',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.key', 'ai.vision.enabled')
        ->assertJsonPath('data.enabled', true)
        ->assertJsonPath('data.rollout_percentage', 25);

    expect(AppConfig::query()->where('key', 'ai.vision.enabled')->exists())->toBeTrue();
});

it('rejects a duplicate key on POST with 422', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    AppConfig::factory()->create(['key' => 'dup.flag']);

    $this->postJson('/api/v1/admin/app-configs', [
        'key' => 'dup.flag',
        'enabled' => true,
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['key']);
});

it('rejects an out-of-range rollout_percentage with 422', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $this->postJson('/api/v1/admin/app-configs', [
        'key' => 'bad.percent',
        'rollout_percentage' => 250,
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['rollout_percentage']);
});

it('shows a feature flag by key', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    AppConfig::factory()->create(['key' => 'show.flag']);

    $this->getJson('/api/v1/admin/app-configs/show.flag')
        ->assertStatus(200)
        ->assertJsonPath('data.key', 'show.flag');
});

it('returns 404 for an unknown flag', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $this->getJson('/api/v1/admin/app-configs/does.not.exist')
        ->assertStatus(404)
        ->assertJsonPath('code', 'NOT_FOUND');
});

it('updates a feature flag via PUT (partial)', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    AppConfig::factory()->enabled(10)->create(['key' => 'partial.flag', 'description' => 'keep me']);

    $this->putJson('/api/v1/admin/app-configs/partial.flag', ['rollout_percentage' => 50])
        ->assertStatus(200)
        ->assertJsonPath('data.rollout_percentage', 50)
        ->assertJsonPath('data.description', 'keep me');
});

it('deletes a feature flag via DELETE', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    AppConfig::factory()->create(['key' => 'doomed.flag']);

    $this->deleteJson('/api/v1/admin/app-configs/doomed.flag')
        ->assertStatus(200)
        ->assertJsonPath('data.deleted', true);

    expect(AppConfig::query()->where('key', 'doomed.flag')->exists())->toBeFalse();
});

it('evaluates an enabled flag with full rollout as true', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    AppConfig::factory()->enabled(100)->create(['key' => 'always.on']);

    $this->getJson('/api/v1/admin/app-configs/always.on/evaluate')
        ->assertStatus(200)
        ->assertJsonPath('data.enabled', true)
        ->assertJsonPath('data.key', 'always.on');
});

it('evaluates a disabled flag as false', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    AppConfig::factory()->create(['key' => 'always.off', 'enabled' => false, 'rollout_percentage' => 100]);

    $this->getJson('/api/v1/admin/app-configs/always.off/evaluate')
        ->assertStatus(200)
        ->assertJsonPath('data.enabled', false);
});

it('evaluates deterministically — the same user always gets the same answer', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    AppConfig::factory()->enabled(50)->create(['key' => 'fifty.fifty']);

    $user = User::factory()->create();
    $first = $this->getJson('/api/v1/admin/app-configs/fifty.fifty/evaluate?user_id='.$user->id)
        ->assertStatus(200)
        ->json('data.enabled');

    $second = $this->getJson('/api/v1/admin/app-configs/fifty.fifty/evaluate?user_id='.$user->id)
        ->assertStatus(200)
        ->json('data.enabled');

    expect($first)->toBe($second);
});

it('returns 404 for evaluate on an unknown flag', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $this->getJson('/api/v1/admin/app-configs/does.not.exist/evaluate')
        ->assertStatus(404);
});
