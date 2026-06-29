<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    Role::firstOrCreate(['name' => 'citizen', 'guard_name' => 'web']);
});

it('rejects the users list without auth', function (): void {
    $this->getJson('/api/v1/admin/users')->assertStatus(401);
});

it('rejects a non-admin on the users list', function (): void {
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/users')->assertStatus(403);
});

it('lists users for a super_admin', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    User::factory()->count(3)->create();

    $r = $this->getJson('/api/v1/admin/users');
    $r->assertOk()->assertJsonPath('meta.total', 4);
});

it('filters the list by role and search', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $citizen = User::factory()->create(['mobile' => '9444444444']);
    $citizen->assignRole('citizen');
    $mod = User::factory()->create(['mobile' => '9555555555']);
    $mod->assignRole('moderator');

    $r = $this->getJson('/api/v1/admin/users?q=9444');
    $r->assertOk()->assertJsonPath('meta.total', 1);
    expect($r->json('data.0.mobile'))->toBe('9444444444');

    $r = $this->getJson('/api/v1/admin/users?role=moderator');
    $r->assertOk()->assertJsonPath('meta.total', 1);
    expect($r->json('data.0.id'))->toBe($mod->id);
});

it('creates a user with roles and hashes the password', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $r = $this->postJson('/api/v1/admin/users', [
        'name' => 'Jane Q',
        'mobile' => '9222222222',
        'email' => 'jane@example.test',
        'password' => 'super-secret',
        'status' => 'active',
        'roles' => ['citizen'],
    ]);

    $r->assertCreated()
        ->assertJsonPath('data.mobile', '9222222222')
        ->assertJsonPath('data.roles.0', 'citizen');

    $created = User::query()->where('mobile', '9222222222')->firstOrFail();
    expect(Hash::check('super-secret', $created->password))->toBeTrue();
    expect($created->hasRole('citizen'))->toBeTrue();
});

it('rejects unknown role names on create with 422', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $r = $this->postJson('/api/v1/admin/users', [
        'mobile' => '9333333333',
        'roles' => ['citizen', 'not-a-real-role'],
    ]);
    $r->assertStatus(422)
        ->assertJsonPath('code', 'UNKNOWN_ROLES');
});

it('updates a user, syncs roles, and emits UserUpdated', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $target = User::factory()->create(['mobile' => '9111111111', 'status' => 'pending']);
    $target->assignRole('citizen');

    $r = $this->putJson("/api/v1/admin/users/{$target->id}", [
        'status' => 'active',
        'roles' => ['moderator'],
    ]);
    $r->assertOk()->assertJsonPath('data.status', 'active');

    $target->refresh();
    expect($target->status)->toBe('active')
        ->and($target->hasRole('moderator'))->toBeTrue()
        ->and($target->hasRole('citizen'))->toBeFalse();
});

it('soft-deletes a user and can restore it', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $target = User::factory()->create(['mobile' => '9666666666']);

    $this->deleteJson("/api/v1/admin/users/{$target->id}")->assertOk();
    expect(User::query()->withTrashed()->where('id', $target->id)->first()->deleted_at)->not->toBeNull();

    $this->postJson("/api/v1/admin/users/{$target->id}/restore")->assertOk();
    expect(User::query()->where('id', $target->id)->first()->deleted_at)->toBeNull();
});

it('returns 404 on show for a missing user', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/admin/users/00000000-0000-0000-0000-000000000099')
        ->assertStatus(404);
});
