<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function makeSuperAdmin(): User
{
    $user = User::factory()->create();
    $user->assignRole('super_admin');

    return $user;
}

it('rejects unauthenticated callers with 401', function (): void {
    $this->getJson('/api/v1/admin/departments')->assertStatus(401);
});

it('rejects authenticated non-admin callers with 403', function (): void {
    Sanctum::actingAs(User::factory()->create());
    $this->getJson('/api/v1/admin/departments')->assertStatus(403);
});

it('lists departments paginated when called by super_admin', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    Department::factory()->count(3)->create();

    $response = $this->getJson('/api/v1/admin/departments?per_page=2');

    $response->assertStatus(200)
        ->assertJsonPath('data', fn ($data) => is_array($data) && count($data) === 2)
        ->assertJsonPath('meta.total', 3);
});

it('creates a department via POST', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $response = $this->postJson('/api/v1/admin/departments', [
        'name' => 'Public Works',
        'code' => 'PWD',
        'jurisdiction' => 'City-wide',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.name', 'Public Works')
        ->assertJsonPath('data.code', 'PWD');
    expect(Department::query()->where('code', 'PWD')->exists())->toBeTrue();
});

it('rejects a duplicate code with 422', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    Department::factory()->create(['code' => 'DUP']);

    $this->postJson('/api/v1/admin/departments', [
        'name' => 'Other',
        'code' => 'DUP',
    ])->assertStatus(422);
});

it('shows a single department by id', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    $dept = Department::factory()->create();

    $this->getJson("/api/v1/admin/departments/{$dept->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.id', $dept->id);
});

it('returns 404 for an unknown id', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $this->getJson('/api/v1/admin/departments/00000000-0000-0000-0000-000000000000')
        ->assertStatus(404);
});

it('updates a department via PUT (partial)', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    $dept = Department::factory()->create(['name' => 'Old', 'code' => 'OLD']);

    $this->putJson("/api/v1/admin/departments/{$dept->id}", ['name' => 'New'])
        ->assertStatus(200)
        ->assertJsonPath('data.name', 'New');
    // code preserved
    $dept->refresh();
    expect($dept->code)->toBe('OLD');
});

it('soft-deletes a department via DELETE', function (): void {
    Sanctum::actingAs(makeSuperAdmin());
    $dept = Department::factory()->create();

    $this->deleteJson("/api/v1/admin/departments/{$dept->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.deleted', true);

    expect(Department::query()->find($dept->id))->toBeNull()
        ->and(Department::onlyTrashed()->find($dept->id))->not->toBeNull();
});

it('validates input on POST', function (): void {
    Sanctum::actingAs(makeSuperAdmin());

    $this->postJson('/api/v1/admin/departments', [
        'name' => '',
        'code' => str_repeat('X', 64), // too long
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'code']);
});
