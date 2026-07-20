<?php

declare(strict_types=1);

use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function aiProviderSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('GET /admin/ai/providers returns a paginated list', function (): void {
    Sanctum::actingAs(aiProviderSuperAdmin());
    AiProviderConfig::query()->create([
        'code' => 'p1', 'name' => 'P1', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);

    $this->getJson('/api/v1/admin/ai/providers')
        ->assertOk()
        ->assertJsonStructure(['data' => [['id', 'code', 'name', 'active']]]);
});

it('the resource hides credentials and surfaces has_secret', function (): void {
    Sanctum::actingAs(aiProviderSuperAdmin());
    $cfg = AiProviderConfig::query()->create([
        'code' => 'p2', 'driver' => 'openai_compatible', 'name' => 'P2', 'base_url' => 'http://x', 'auth_type' => 'bearer',
        'credentials' => ['api_key' => 'sk-super-secret'],
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);

    $this->getJson('/api/v1/admin/ai/providers/'.$cfg->id)
        ->assertOk()
        ->assertJsonPath('data.has_secret', true)
        ->assertJsonMissing(['credentials' => ['api_key' => 'sk-super-secret']]);
});

it('the resource masks header-based secrets but keeps non-secret headers', function (): void {
    Sanctum::actingAs(aiProviderSuperAdmin());
    $cfg = AiProviderConfig::query()->create([
        'code' => 'modal', 'driver' => 'openai_compatible', 'name' => 'Modal', 'base_url' => 'http://x', 'auth_type' => 'header',
        'credentials' => null,
        'extra_headers' => [
            'Modal-Key' => 'wk-super-secret',
            'Modal-Secret' => 'ws-super-secret',
            'X-Title' => 'Civic Intelligence Platform',
        ],
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);

    $response = $this->getJson('/api/v1/admin/ai/providers/'.$cfg->id)
        ->assertOk()
        // Header secrets count toward has_secret even without credentials.api_key.
        ->assertJsonPath('data.has_secret', true)
        // Non-sensitive header names/values are preserved.
        ->assertJsonPath('data.extra_headers.X-Title', 'Civic Intelligence Platform');

    expect($response->json('data.extra_headers.Modal-Key'))->not->toBe('wk-super-secret');
    expect($response->json('data.extra_headers.Modal-Secret'))->not->toBe('ws-super-secret');
    // The raw secret must not appear anywhere in the response body.
    expect($response->getContent())->not->toContain('wk-super-secret');
    expect($response->getContent())->not->toContain('ws-super-secret');
});

it('POST /admin/ai/providers creates a custom OpenAI-compatible provider (e.g. OpenRouter)', function (): void {
    Sanctum::actingAs(aiProviderSuperAdmin());

    $this->postJson('/api/v1/admin/ai/providers', [
        'code' => 'newone',
        'driver' => 'openai_compatible',
        'name' => 'OpenRouter',
        'base_url' => 'https://openrouter.ai/api',
        'auth_type' => 'bearer',
        'credentials' => ['api_key' => 'sk-or-test'],
        'extra_headers' => ['HTTP-Referer' => 'https://civic-intelligence.example', 'X-Title' => 'Civic Intelligence Platform'],
        'model' => 'gpt-4o',
        'temperature' => 0.2,
        'timeout_ms' => 30000,
        'retry_count' => 2,
        'is_fallback' => false,
        'priority' => 50,
        'active' => true,
    ])->assertCreated()
        ->assertJsonPath('data.code', 'newone')
        ->assertJsonPath('data.driver', 'openai_compatible')
        ->assertJsonPath('data.has_secret', true)
        ->assertJsonPath('data.extra_headers.X-Title', 'Civic Intelligence Platform');
});

it('POST /admin/ai/providers rejects an unknown driver', function (): void {
    Sanctum::actingAs(aiProviderSuperAdmin());

    $this->postJson('/api/v1/admin/ai/providers', [
        'code' => 'bad-driver', 'driver' => 'not_a_real_driver', 'name' => 'A', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ])->assertStatus(422);
});

it('POST /admin/ai/providers rejects a duplicate code', function (): void {
    Sanctum::actingAs(aiProviderSuperAdmin());
    AiProviderConfig::query()->create([
        'code' => 'dupe', 'driver' => 'mock', 'name' => 'A', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);

    $this->postJson('/api/v1/admin/ai/providers', [
        'code' => 'dupe', 'driver' => 'mock', 'name' => 'B', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ])->assertStatus(422);
});

it('PUT /admin/ai/providers/{id} updates the provider', function (): void {
    Sanctum::actingAs(aiProviderSuperAdmin());
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
    Sanctum::actingAs(aiProviderSuperAdmin());
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
