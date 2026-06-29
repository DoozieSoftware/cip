<?php

declare(strict_types=1);

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

it('rejects the audit log without auth', function (): void {
    $this->getJson('/api/v1/admin/audit-logs')->assertStatus(401);
});

it('rejects a citizen (no admin/auditor role) on the audit log', function (): void {
    Role::firstOrCreate(['name' => 'citizen', 'guard_name' => 'web']);
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/audit-logs')->assertStatus(403);
});

it('returns the audit log for a super_admin', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    AuditLog::query()->create([
        'user_id' => $admin->id,
        'entity' => 'reports',
        'entity_id' => '00000000-0000-0000-0000-000000000001',
        'action' => 'report.department_action',
        'before' => null,
        'after' => ['status' => 'accepted'],
        'ip' => '127.0.0.1',
        'device_fingerprint' => null,
        'request_id' => 'tid-test',
        'created_at' => now(),
    ]);

    $r = $this->getJson('/api/v1/admin/audit-logs');
    $r->assertOk()->assertJsonPath('meta.total', 1);
    expect($r->json('data.0.entity'))->toBe('reports');
    expect($r->json('data.0.action'))->toBe('report.department_action');
});

it('filters the audit log by action and entity', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    AuditLog::query()->create([
        'user_id' => $admin->id,
        'entity' => 'reports',
        'entity_id' => '00000000-0000-0000-0000-000000000001',
        'action' => 'report.department_action',
        'before' => null,
        'after' => null,
        'ip' => null,
        'device_fingerprint' => null,
        'request_id' => null,
        'created_at' => now(),
    ]);
    AuditLog::query()->create([
        'user_id' => $admin->id,
        'entity' => 'departments',
        'entity_id' => '00000000-0000-0000-0000-000000000002',
        'action' => 'department.officer_attached',
        'before' => null,
        'after' => null,
        'ip' => null,
        'device_fingerprint' => null,
        'request_id' => null,
        'created_at' => now(),
    ]);

    $r = $this->getJson('/api/v1/admin/audit-logs?entity=departments');
    $r->assertOk()->assertJsonPath('meta.total', 1);
    expect($r->json('data.0.entity'))->toBe('departments');

    $r = $this->getJson('/api/v1/admin/audit-logs?action=department.officer');
    $r->assertOk()->assertJsonPath('meta.total', 1);
    expect($r->json('data.0.action'))->toContain('department.officer');
});

it('respects the per_page cap of 500', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $r = $this->getJson('/api/v1/admin/audit-logs?per_page=99999');
    $r->assertOk();
    expect($r->json('meta.per_page'))->toBe(500);
});

it('filters the audit log by role, ip and device fingerprint', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    // Build a moderator with audit rows tagged to their user.
    Role::firstOrCreate(['name' => 'moderator', 'guard_name' => 'web']);
    $mod = User::factory()->create();
    $mod->assignRole('moderator');

    AuditLog::query()->create([
        'user_id' => $mod->id,
        'entity' => 'reports',
        'entity_id' => '00000000-0000-0000-0000-000000000010',
        'action' => 'moderation.review',
        'before' => null,
        'after' => null,
        'ip' => '10.0.0.5',
        'device_fingerprint' => 'browser-fp-A',
        'request_id' => null,
        'created_at' => now(),
    ]);
    AuditLog::query()->create([
        'user_id' => $admin->id,
        'entity' => 'departments',
        'entity_id' => '00000000-0000-0000-0000-000000000020',
        'action' => 'department.officer_attached',
        'before' => null,
        'after' => null,
        'ip' => '192.168.1.1',
        'device_fingerprint' => 'browser-fp-B',
        'request_id' => null,
        'created_at' => now(),
    ]);

    $r = $this->getJson('/api/v1/admin/audit-logs?role=moderator');
    $r->assertOk()->assertJsonPath('meta.total', 1);
    expect($r->json('data.0.roles'))->toContain('moderator');
    expect($r->json('data.0.user_id'))->toBe($mod->id);

    $r = $this->getJson('/api/v1/admin/audit-logs?ip=10.0.0.5');
    $r->assertOk()->assertJsonPath('meta.total', 1);
    expect($r->json('data.0.ip'))->toBe('10.0.0.5');

    $r = $this->getJson('/api/v1/admin/audit-logs?device_fingerprint=browser-fp');
    $r->assertOk()->assertJsonPath('meta.total', 2);
});
