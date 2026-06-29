<?php

declare(strict_types=1);

use App\Modules\Security\Models\SecurityPolicy;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function policySuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('rejects the security-policies list without auth', function (): void {
    $this->getJson('/api/v1/admin/security-policies')->assertStatus(401);
});

it('rejects a non-admin on the security-policies list', function (): void {
    $mod = User::factory()->create();
    $mod->assignRole('moderator');
    Sanctum::actingAs($mod);

    $this->getJson('/api/v1/admin/security-policies')->assertStatus(403);
});

it('upserts a security policy by key', function (): void {
    Sanctum::actingAs(policySuperAdmin());

    $r = $this->postJson('/api/v1/admin/security-policies', [
        'key' => 'password.min_length',
        'value' => ['min' => 8, 'require_symbol' => true],
        'type' => 'array',
        'description' => 'Password length and complexity.',
    ]);
    $r->assertCreated()->assertJsonPath('data.key', 'password.min_length');

    $r2 = $this->postJson('/api/v1/admin/security-policies', [
        'key' => 'password.min_length',
        'value' => ['min' => 12, 'require_symbol' => true],
    ]);
    $r2->assertCreated()->assertJsonPath('data.value.min', 12);
    expect(SecurityPolicy::query()->where('key', 'password.min_length')->count())->toBe(1);
});

it('shows, updates, and deletes by key', function (): void {
    Sanctum::actingAs(policySuperAdmin());
    SecurityPolicy::query()->create([
        'key' => 'otp.expiry_seconds',
        'value' => ['seconds' => 300],
        'type' => 'array',
    ]);

    $this->getJson('/api/v1/admin/security-policies/otp.expiry_seconds')->assertOk()
        ->assertJsonPath('data.key', 'otp.expiry_seconds');

    $this->putJson('/api/v1/admin/security-policies/otp.expiry_seconds', [
        'key' => 'otp.expiry_seconds',
        'value' => ['seconds' => 600],
    ])->assertOk()->assertJsonPath('data.value.seconds', 600);

    $this->deleteJson('/api/v1/admin/security-policies/otp.expiry_seconds')->assertOk();
    expect(SecurityPolicy::query()->where('key', 'otp.expiry_seconds')->exists())->toBeFalse();
});

it('returns 404 for an unknown key', function (): void {
    Sanctum::actingAs(policySuperAdmin());
    $this->getJson('/api/v1/admin/security-policies/nope.nope')->assertStatus(404);
});

it('rejects an invalid key format with 422', function (): void {
    Sanctum::actingAs(policySuperAdmin());
    $this->postJson('/api/v1/admin/security-policies', [
        'key' => 'Has Spaces',
        'value' => ['x' => 1],
    ])->assertStatus(422);
});
