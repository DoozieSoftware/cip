<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

it('rejects the admin department endpoints without auth', function (): void {
    $dept = Department::factory()->create();
    $this->getJson("/api/v1/admin/departments/{$dept->id}/officers")->assertStatus(401);
});

it('rejects non-super_admin users on the admin endpoints', function (): void {
    Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
    $dept = Department::factory()->create();
    $officer = User::factory()->create();
    $officer->assignRole('department');
    Sanctum::actingAs($officer);

    $this->getJson("/api/v1/admin/departments/{$dept->id}/officers")->assertStatus(403);
    $this->patchJson("/api/v1/admin/departments/{$dept->id}/admin", [
        'default_sla_minutes' => 120,
    ])->assertStatus(403);
});

it('lists, attaches, and detaches officers under a department', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $dept = Department::factory()->create();
    $officer = User::factory()->create();
    $officer->assignRole('department');

    // Attach
    $r = $this->postJson("/api/v1/admin/departments/{$dept->id}/officers", [
        'user_id' => $officer->id,
        'is_manager' => true,
    ]);
    $r->assertCreated()->assertJsonPath('data.department_id', $dept->id);
    expect($dept->users()->where('users.id', $officer->id)->exists())->toBeTrue();

    // List
    $r = $this->getJson("/api/v1/admin/departments/{$dept->id}/officers");
    $r->assertOk()->assertJsonPath('meta.total', 1);
    expect($r->json('data.0.is_manager'))->toBeTrue();

    // Detach
    $r = $this->deleteJson("/api/v1/admin/departments/{$dept->id}/officers/{$officer->id}");
    $r->assertOk()->assertJsonPath('data.removed', true);
    expect($dept->users()->where('users.id', $officer->id)->exists())->toBeFalse();

    // Audit rows were written for attach + detach
    expect(AuditLog::query()->where('action', 'department.officer_attached')->count())->toBe(1);
    expect(AuditLog::query()->where('action', 'department.officer_detached')->count())->toBe(1);
});

it('rejects attaching a user without a staff role', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'citizen', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $dept = Department::factory()->create();
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');

    $this->postJson("/api/v1/admin/departments/{$dept->id}/officers", [
        'user_id' => $citizen->id,
    ])->assertStatus(422);
});

it('updates SLA, working hours, holiday calendar, and escalation matrix in one transaction', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $dept = Department::factory()->create([
        'default_sla_minutes' => 60,
        'working_hours' => null,
        'holiday_calendar' => null,
    ]);

    $r = $this->patchJson("/api/v1/admin/departments/{$dept->id}/admin", [
        'default_sla_minutes' => 240,
        'working_hours' => [
            ['day' => 'mon', 'open' => '09:00', 'close' => '17:00'],
            ['day' => 'fri', 'open' => '09:00', 'close' => '13:00'],
        ],
        'holiday_calendar' => ['2026-12-25', '2026-12-26'],
        'escalation_matrix' => [
            ['after_minutes' => 60, 'escalate_to' => null],
        ],
    ]);
    $r->assertOk()
        ->assertJsonPath('data.default_sla_minutes', 240)
        ->assertJsonPath('data.working_hours.0.day', 'mon')
        ->assertJsonPath('data.holiday_calendar.0', '2026-12-25');

    expect(AuditLog::query()->where('action', 'department.admin_updated')->count())->toBe(1);
});

it('rejects an invalid working_hours row with 422', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $dept = Department::factory()->create();
    $this->patchJson("/api/v1/admin/departments/{$dept->id}/admin", [
        'working_hours' => [
            ['day' => 'funday', 'open' => '09:00', 'close' => '17:00'],
        ],
    ])->assertStatus(422);
});
