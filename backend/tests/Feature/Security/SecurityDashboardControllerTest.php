<?php

declare(strict_types=1);

use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

it('rejects the security dashboard without auth', function (): void {
    $this->getJson('/api/v1/admin/security/dashboard')->assertStatus(401);
});

it('rejects a citizen (no admin/auditor role) on the security dashboard', function (): void {
    Role::firstOrCreate(['name' => 'citizen', 'guard_name' => 'web']);
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/security/dashboard')->assertStatus(403);
});

it('returns the security dashboard for a super_admin', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    // Seed: one failed login row, one mock_gps event, one critical alert.
    DB::table('login_histories')->insert([
        'id' => '00000000-0000-0000-0000-00000000a001',
        'user_id' => null,
        'mobile' => '9000000000',
        'success' => false,
        'failure_reason' => 'invalid_code',
        'login_at' => now(),
    ]);
    SecurityEvent::query()->create([
        'user_id' => null,
        'event' => 'mock_gps',
        'severity' => SecurityEvent::SEVERITY_WARNING,
        'ip' => '10.0.0.1',
    ]);
    SecurityEvent::query()->create([
        'user_id' => null,
        'event' => 'token.reuse_detected',
        'severity' => SecurityEvent::SEVERITY_CRITICAL,
        'ip' => '10.0.0.2',
    ]);

    $r = $this->getJson('/api/v1/admin/security/dashboard');
    $r->assertOk()
        ->assertJsonPath('data.failed_logins.count', 1)
        ->assertJsonPath('data.mock_gps_reports.count', 1)
        ->assertJsonPath('data.security_alerts.count', 1)
        ->assertJsonPath('data.suspicious_devices.count', 1);
    expect($r->json('data.generated_at'))->not->toBeNull();
});

it('counts locked and blocked users from users.status', function (): void {
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    User::factory()->count(2)->create(['status' => 'suspended']);
    User::factory()->count(3)->create(['status' => 'banned']);
    User::factory()->count(4)->create(['status' => 'active']);

    $r = $this->getJson('/api/v1/admin/security/dashboard');
    $r->assertOk()
        ->assertJsonPath('data.locked_accounts.count', 2)
        ->assertJsonPath('data.blocked_users.count', 3);
});
