<?php

declare(strict_types=1);

use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function superAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('GET /admin/ai/providers returns a paginated list', function (): void {
    Sanctum::actingAs(superAdmin());
    AiProviderConfig::query()->create([
        'code' => 'p1', 'name' => 'P1', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);

    $this->getJson('/api/v1/admin/ai/providers')
        ->assertOk()
        ->assertJsonStructure(['data' => [['id', 'code', 'name', 'active']]]);
});

it('the resource hides api_key_secret_id and surfaces has_secret', function (): void {
    Sanctum::actingAs(superAdmin());
    $cfg = AiProviderConfig::query()->create([
        'code' => 'p2', 'name' => 'P2', 'base_url' => 'http://x', 'auth_type' => 'bearer',
        'api_key_secret_id' => '11111111-1111-1111-1111-111111111111',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);

    $this->getJson('/api/v1/admin/ai/providers/'.$cfg->id)
        ->assertOk()
        ->assertJsonPath('data.has_secret', true)
        ->assertJsonMissing(['api_key_secret_id' => '11111111-1111-1111-1111-111111111111']);
});

it('POST /admin/ai/providers creates a provider', function (): void {
    Sanctum::actingAs(superAdmin());

    $this->postJson('/api/v1/admin/ai/providers', [
        'code' => 'newone',
        'name' => 'New One',
        'base_url' => 'https://api.example.com',
        'auth_type' => 'bearer',
        'model' => 'gpt-4o',
        'temperature' => 0.2,
        'timeout_ms' => 30000,
        'retry_count' => 2,
        'is_fallback' => false,
        'priority' => 50,
        'active' => true,
    ])->assertCreated()
        ->assertJsonPath('data.code', 'newone')->assertJsonPath('data.name', 'New One');
});

it('POST /admin/ai/providers rejects a duplicate code', function (): void {
    Sanctum::actingAs(superAdmin());
    AiProviderConfig::query()->create([
        'code' => 'dupe', 'name' => 'A', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);

    $this->postJson('/api/v1/admin/ai/providers', [
        'code' => 'dupe', 'name' => 'B', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ])->assertStatus(422);
});

it('PUT /admin/ai/providers/{id} updates the provider', function (): void {
    Sanctum::actingAs(superAdmin());
    $cfg = AiProviderConfig::query()->create([
        'code' => 'p3', 'name' => 'P3', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);

    $this->putJson('/api/v1/admin/ai/providers/'.$cfg->id, ['name' => 'P3 Renamed'])
        ->assertOk()
        ->assertJsonPath('data.name', 'P3 Renamed');
});

it('DELETE /admin/ai/providers/{id} removes the provider', function (): void {
    Sanctum::actingAs(superAdmin());
    $cfg = AiProviderConfig::query()->create([
        'code' => 'p4', 'name' => 'P4', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);

    $this->deleteJson('/api/v1/admin/ai/providers/'.$cfg->id)
        ->assertOk()
        ->assertJson(['status' => 'deleted']);

    expect(AiProviderConfig::query()->find($cfg->id))->toBeNull();
});

it('rejects callers without the super_admin role (403)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/ai/providers')->assertStatus(403);
});
