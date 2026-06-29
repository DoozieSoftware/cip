<?php

declare(strict_types=1);

use App\Modules\Integrations\Models\Integration;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function integrationSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('rejects the integrations list without auth', function (): void {
    $this->getJson('/api/v1/admin/integrations')->assertStatus(401);
});

it('rejects a non-admin on the integrations list', function (): void {
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/integrations')->assertStatus(403);
});

it('lists, creates, updates, and soft-deletes integrations with masked credentials', function (): void {
    Sanctum::actingAs(integrationSuperAdmin());
    Integration::factory()->create(['code' => 'gmc', 'display_name' => 'GMC', 'provider' => 'gmc']);

    $list = $this->getJson('/api/v1/admin/integrations');
    $list->assertOk()->assertJsonPath('data.0.code', 'gmc');
    expect($list->json('data.0.credentials'))->toBeArray();

    $created = $this->postJson('/api/v1/admin/integrations', [
        'code' => 'bbmp',
        'provider' => 'bbmp',
        'display_name' => 'BBMP',
        'base_url' => 'https://bbmp.example.gov.in/api',
        'credentials' => ['api_key' => 'plain-secret'],
    ]);
    $created->assertCreated()->assertJsonPath('data.code', 'bbmp');
    expect($created->json('data.credentials.api_key'))->toBe('********');

    $id = $created->json('data.id');

    $updated = $this->putJson("/api/v1/admin/integrations/{$id}", [
        'display_name' => 'BBMP v2',
        'status' => 'degraded',
    ]);
    $updated->assertOk()->assertJsonPath('data.display_name', 'BBMP v2')
        ->assertJsonPath('data.status', 'degraded');

    $this->deleteJson("/api/v1/admin/integrations/{$id}")->assertOk();
    expect(Integration::find($id))->toBeNull();
    expect(Integration::withTrashed()->find($id))->not->toBeNull();

    $this->postJson("/api/v1/admin/integrations/{$id}/restore")->assertOk();
    expect(Integration::find($id))->not->toBeNull();
});

it('rejects a duplicate code on create with 422', function (): void {
    Sanctum::actingAs(integrationSuperAdmin());
    Integration::factory()->create(['code' => 'dup', 'display_name' => 'Dup', 'provider' => 'gmc']);

    $this->postJson('/api/v1/admin/integrations', [
        'code' => 'dup',
        'provider' => 'gmc',
        'display_name' => 'Dup2',
        'base_url' => 'https://dup.example.com',
        'credentials' => ['api_key' => 'x'],
    ])->assertStatus(422);
});

it('runs a health probe and flips status to active on 2xx', function (): void {
    Http::fake([
        'integration-good.example.com/*' => Http::response('OK', 200),
    ]);

    Sanctum::actingAs(integrationSuperAdmin());
    $row = Integration::factory()->create([
        'code' => 'good',
        'display_name' => 'Good',
        'provider' => 'gmc',
        'base_url' => 'https://integration-good.example.com/ping',
        'status' => 'degraded',
    ]);

    $r = $this->postJson("/api/v1/admin/integrations/{$row->id}/health");
    $r->assertOk()->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.last_error', null);
    expect($r->json('data.last_check_at'))->not->toBeNull();
});

it('flips status to degraded on non-2xx response', function (): void {
    Http::fake([
        'integration-bad.example.com/*' => Http::response('boom', 503),
    ]);

    Sanctum::actingAs(integrationSuperAdmin());
    $row = Integration::factory()->create([
        'code' => 'bad',
        'display_name' => 'Bad',
        'provider' => 'bbmp',
        'base_url' => 'https://integration-bad.example.com/ping',
    ]);

    $r = $this->postJson("/api/v1/admin/integrations/{$row->id}/health");
    $r->assertOk()->assertJsonPath('data.status', 'degraded');
    expect($r->json('data.last_error'))->toContain('http_503');
});

it('rejects probing a disabled integration', function (): void {
    Sanctum::actingAs(integrationSuperAdmin());
    $row = Integration::factory()->create([
        'code' => 'off',
        'display_name' => 'Off',
        'provider' => 'pgportal',
        'status' => 'disabled',
    ]);

    $this->postJson("/api/v1/admin/integrations/{$row->id}/health")
        ->assertStatus(409)
        ->assertJsonPath('code', 'CONFLICT');
});
