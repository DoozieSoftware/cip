<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function roleSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('rejects the roles list without auth', function (): void {
    $this->getJson('/api/v1/admin/roles')->assertStatus(401);
});

it('rejects a non-admin on the roles list', function (): void {
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/roles')->assertStatus(403);
});

it('lists roles with their permissions', function (): void {
    Sanctum::actingAs(roleSuperAdmin());

    $r = $this->getJson('/api/v1/admin/roles');
    $r->assertOk();
    expect($r->json('meta.total'))->toBeGreaterThan(0);
    $first = collect($r->json('data'))->firstWhere('name', 'super_admin');
    expect($first)->not->toBeNull();
    expect($first['protected'])->toBeTrue();
});

it('creates a custom role with a subset of permissions', function (): void {
    Sanctum::actingAs(roleSuperAdmin());

    $r = $this->postJson('/api/v1/admin/roles', [
        'name' => 'ward_officer',
        'guard_name' => 'web',
        'permissions' => ['reports.view'],
    ]);
    $r->assertCreated()
        ->assertJsonPath('data.name', 'ward_officer')
        ->assertJsonPath('data.protected', false);

    expect(Role::where('name', 'ward_officer')->exists())->toBeTrue();
    $role = Role::where('name', 'ward_officer')->firstOrFail();
    expect($role->hasPermissionTo('reports.view'))->toBeTrue();
});

it('rejects unknown permission names on role create with 422', function (): void {
    Sanctum::actingAs(roleSuperAdmin());

    $r = $this->postJson('/api/v1/admin/roles', [
        'name' => 'analyst',
        'permissions' => ['reports.view', 'not-a-real-permission'],
    ]);
    $r->assertStatus(422)->assertJsonPath('code', 'UNKNOWN_PERMISSIONS');
});

it('syncs the permission list of an existing role', function (): void {
    Sanctum::actingAs(roleSuperAdmin());
    $role = Role::firstOrCreate(['name' => 'dept_lead', 'guard_name' => 'web']);

    $r = $this->postJson("/api/v1/admin/roles/{$role->id}/permissions/sync", [
        'permissions' => ['reports.view', 'reports.assign'],
    ]);
    $r->assertOk();
    $role->refresh();
    expect($role->hasPermissionTo('reports.view'))->toBeTrue()
        ->and($role->hasPermissionTo('reports.assign'))->toBeTrue();
});

it('forbids deletion of the super_admin role', function (): void {
    Sanctum::actingAs(roleSuperAdmin());
    $admin = Role::where('name', 'super_admin')->firstOrFail();

    $this->deleteJson("/api/v1/admin/roles/{$admin->id}")->assertStatus(403);
    expect(Role::where('name', 'super_admin')->exists())->toBeTrue();
});

it('allows deletion of a custom role', function (): void {
    Sanctum::actingAs(roleSuperAdmin());
    $role = Role::firstOrCreate(['name' => 'temp_role', 'guard_name' => 'web']);

    $this->deleteJson("/api/v1/admin/roles/{$role->id}")->assertOk();
    expect(Role::where('name', 'temp_role')->exists())->toBeFalse();
});

it('lists, creates, and deletes permissions', function (): void {
    Sanctum::actingAs(roleSuperAdmin());

    $r = $this->getJson('/api/v1/admin/permissions');
    $r->assertOk();
    expect($r->json('meta.total'))->toBeGreaterThan(0);

    $r = $this->postJson('/api/v1/admin/permissions', [
        'name' => 'reports.export_csv',
        'guard_name' => 'web',
    ]);
    $r->assertCreated()->assertJsonPath('data.name', 'reports.export_csv');

    $perm = Permission::where('name', 'reports.export_csv')->firstOrFail();
    $this->deleteJson("/api/v1/admin/permissions/{$perm->id}")->assertOk();
    expect(Permission::where('name', 'reports.export_csv')->exists())->toBeFalse();
});
