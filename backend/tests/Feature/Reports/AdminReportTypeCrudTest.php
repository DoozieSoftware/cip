<?php

declare(strict_types=1);

use App\Modules\Reports\Models\ReportType;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function reportTypeSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('rejects the report-types list without auth', function (): void {
    $this->getJson('/api/v1/admin/report-types')->assertStatus(401);
});

it('rejects a non-admin on the report-types list', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/report-types')->assertStatus(403);
});

it('lists, creates, updates, soft-deletes, and restores report types', function (): void {
    Sanctum::actingAs(reportTypeSuperAdmin());
    $seed = ReportType::factory()->create(['code' => 'pothole', 'name' => 'Pothole']);

    $r = $this->getJson('/api/v1/admin/report-types');
    $r->assertOk()->assertJsonPath('data.0.id', $seed->id);

    $created = $this->postJson('/api/v1/admin/report-types', [
        'name' => 'Illegal Parking',
        'code' => 'illegal_parking',
        'icon' => 'parking',
        'color' => '#FF5722',
        'requires_video' => true,
        'requires_photo' => true,
    ]);
    $created->assertCreated()->assertJsonPath('data.code', 'illegal_parking');
    $newId = $created->json('data.id');
    expect(ReportType::withTrashed()->find($newId))->not->toBeNull();

    $updated = $this->putJson("/api/v1/admin/report-types/{$newId}", [
        'name' => 'Illegal Parking v2',
        'active' => false,
    ]);
    $updated->assertOk()->assertJsonPath('data.name', 'Illegal Parking v2')
        ->assertJsonPath('data.active', false);

    $this->deleteJson("/api/v1/admin/report-types/{$newId}")->assertOk();
    expect(ReportType::find($newId))->toBeNull();
    expect(ReportType::withTrashed()->find($newId))->not->toBeNull();

    $this->postJson("/api/v1/admin/report-types/{$newId}/restore")->assertOk()
        ->assertJsonPath('data.id', $newId);
    expect(ReportType::find($newId))->not->toBeNull();
});

it('rejects unknown department on create with 422', function (): void {
    Sanctum::actingAs(reportTypeSuperAdmin());

    $this->postJson('/api/v1/admin/report-types', [
        'name' => 'Bogus',
        'code' => 'bogus',
        'department_default_id' => '00000000-0000-0000-0000-000000000000',
    ])->assertStatus(422);
});

it('rejects duplicate code on create with 422', function (): void {
    Sanctum::actingAs(reportTypeSuperAdmin());
    ReportType::factory()->create(['code' => 'pothole']);

    $this->postJson('/api/v1/admin/report-types', [
        'name' => 'Pothole Two',
        'code' => 'pothole',
    ])->assertStatus(422);
});

it('forbids a moderator from creating a report type', function (): void {
    $mod = User::factory()->create();
    $mod->assignRole('moderator');
    Sanctum::actingAs($mod);

    $this->postJson('/api/v1/admin/report-types', [
        'name' => 'Nope',
        'code' => 'nope',
    ])->assertStatus(403);
});
