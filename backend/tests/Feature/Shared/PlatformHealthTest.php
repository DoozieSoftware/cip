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

function healthSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('rejects the platform health endpoint without auth', function (): void {
    $this->getJson('/api/v1/admin/health')->assertStatus(401);
});

it('rejects a non-admin on the platform health endpoint', function (): void {
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/health')->assertStatus(403);
});

it('returns a platform health summary with all six components', function (): void {
    AiProviderConfig::query()->create([
        'code' => 'local-mock',
        'name' => 'Local Mock',
        'base_url' => 'http://localhost:9999',
        'auth_type' => 'none',
        'model' => 'mock-v1',
        'temperature' => 0.0,
        'timeout_ms' => 5000,
        'retry_count' => 1,
        'is_fallback' => true,
        'priority' => 100,
        'active' => true,
    ]);

    Sanctum::actingAs(healthSuperAdmin());

    $r = $this->getJson('/api/v1/admin/health');
    $r->assertOk()
        ->assertJsonStructure([
            'data' => [
                'status',
                'checked_at',
                'components' => ['database', 'redis', 'queue', 'ai', 'storage', 'scheduler'],
            ],
        ]);

    $components = $r->json('data.components');
    expect($components['database']['status'])->toBe('ok');
    expect($components['ai']['status'])->toBe('ok');
    expect($components['ai']['active_providers'])->toBe(1);
    expect($components['storage']['disk'])->not->toBeNull();
});

it('reports ai as degraded when no active provider is configured', function (): void {
    Sanctum::actingAs(healthSuperAdmin());

    $r = $this->getJson('/api/v1/admin/health');
    $r->assertOk();
    expect($r->json('data.components.ai.status'))->toBe('degraded');
});

it('lists components on the dedicated endpoint', function (): void {
    Sanctum::actingAs(healthSuperAdmin());

    $r = $this->getJson('/api/v1/admin/health/components');
    $r->assertOk()
        ->assertJsonStructure([
            'data' => [
                'components' => ['database', 'redis', 'queue', 'ai', 'storage', 'scheduler'],
                'checked_at',
            ],
        ]);
});
