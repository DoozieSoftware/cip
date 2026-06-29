<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Organization;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function orgSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('rejects the organizations list without auth', function (): void {
    $this->getJson('/api/v1/admin/organizations')->assertStatus(401);
});

it('rejects a non-admin on the organizations list', function (): void {
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/organizations')->assertStatus(403);
});

it('lists, creates, updates, and soft-deletes organizations', function (): void {
    Sanctum::actingAs(orgSuperAdmin());
    Organization::factory()->create(['code' => 'gmc', 'name' => 'GMC']);

    $list = $this->getJson('/api/v1/admin/organizations');
    $list->assertOk()->assertJsonPath('data.0.code', 'gmc');

    $created = $this->postJson('/api/v1/admin/organizations', [
        'code' => 'bbmp',
        'name' => 'BBMP',
        'legal_name' => 'Bruhat Bengaluru Mahanagara Palike',
        'branding' => ['primary_color' => '#08BDBA', 'logo_url' => 'https://cdn.example.com/bbmp.png'],
        'storage_quota_mb' => 10240,
    ]);
    $created->assertCreated()
        ->assertJsonPath('data.code', 'bbmp')
        ->assertJsonPath('data.branding.primary_color', '#08BDBA')
        ->assertJsonPath('data.storage_quota_mb', 10240);

    $id = $created->json('data.id');

    $updated = $this->putJson("/api/v1/admin/organizations/{$id}", [
        'name' => 'BBMP v2',
        'active' => false,
    ]);
    $updated->assertOk()
        ->assertJsonPath('data.name', 'BBMP v2')
        ->assertJsonPath('data.active', false);

    $this->deleteJson("/api/v1/admin/organizations/{$id}")->assertOk();
    expect(Organization::find($id))->toBeNull();
    expect(Organization::withTrashed()->find($id))->not->toBeNull();

    $this->postJson("/api/v1/admin/organizations/{$id}/restore")->assertOk();
    expect(Organization::find($id))->not->toBeNull();
});

it('rejects a duplicate code on create with 422', function (): void {
    Sanctum::actingAs(orgSuperAdmin());
    Organization::factory()->create(['code' => 'dup']);

    $this->postJson('/api/v1/admin/organizations', [
        'code' => 'dup',
        'name' => 'Dup',
    ])->assertStatus(422);
});

it('rejects a bad logo URL on create with 422', function (): void {
    Sanctum::actingAs(orgSuperAdmin());

    $this->postJson('/api/v1/admin/organizations', [
        'code' => 'bad',
        'name' => 'Bad',
        'branding' => ['logo_url' => 'not-a-url'],
    ])->assertStatus(422);
});
