<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;

/**
 * Coverage for the platform-wide authorization contract per
 * docs/11 §9. The test registers synthetic policies on the
 * Gate facade that exercise the same role-based rules that
 * the real policies (added in M10 / M11 / M12) will use. The
 * policies use the same role names that the seeder wires up,
 * so when a moderator-policy lands in M10 it will already
 * match this contract.
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();

    // Synthetic policies used by the test routes. The real
    // policies (ReportPolicy, UserPolicy, AuditLogPolicy) land
    // in M10 / M11 / M12 — until they exist we register
    // inline Gate definitions that capture the same rules
    // as `BasePolicy::before()` plus the per-ability check.
    // `super_admin` and `system` always pass; everyone else
    // is matched by their named role. Suspended / disabled /
    // pending / trashed users are always denied, mirroring
    // the platform-wide contract.
    $baseCheck = static function (User $user): bool {
        if ($user->trashed()) {
            return false;
        }

        if (in_array((string) $user->status, ['suspended', 'disabled', 'pending'], true)) {
            return false;
        }

        return true;
    };
    Gate::define('moderate-reports', static function (User $user) use ($baseCheck): bool {
        return $baseCheck($user) && $user->hasAnyRole(['super_admin', 'system', 'moderator']);
    });
    Gate::define('manage-users', static function (User $user) use ($baseCheck): bool {
        return $baseCheck($user) && $user->hasAnyRole(['super_admin', 'system']);
    });
    Gate::define('view-audit-logs', static function (User $user) use ($baseCheck): bool {
        return $baseCheck($user) && $user->hasAnyRole(['super_admin', 'system', 'auditor']);
    });

    // Register test-only routes gated by the synthetic policies.
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/test/moderator/reports', function (): array {
            Gate::authorize('moderate-reports');

            return ['ok' => true];
        });
        Route::get('/test/admin/users', function (): array {
            Gate::authorize('manage-users');

            return ['ok' => true];
        });
        Route::get('/test/auditor/audit-logs', function (): array {
            Gate::authorize('view-audit-logs');

            return ['ok' => true];
        });
    });
});

it('lets a citizen authenticate but blocks them from moderator routes', function (): void {
    $user = User::factory()->create();
    $user->assignRole('citizen');

    $resp = $this->actingAs($user, 'sanctum')->getJson('/test/moderator/reports');

    $resp->assertStatus(403)
        ->assertJsonPath('success', false)
        ->assertJsonPath('code', 'FORBIDDEN');
});

it('lets a citizen authenticate but blocks them from admin routes', function (): void {
    $user = User::factory()->create();
    $user->assignRole('citizen');

    $resp = $this->actingAs($user, 'sanctum')->getJson('/test/admin/users');

    $resp->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
});

it('blocks a moderator from admin-only routes', function (): void {
    $user = User::factory()->create();
    $user->assignRole('moderator');

    $resp = $this->actingAs($user, 'sanctum')->getJson('/test/admin/users');

    $resp->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
});

it('lets a moderator access moderator routes', function (): void {
    $user = User::factory()->create();
    $user->assignRole('moderator');

    $this->actingAs($user, 'sanctum')
        ->getJson('/test/moderator/reports')
        ->assertOk()
        ->assertJsonPath('ok', true);
});

it('lets a super_admin access every gated route (bypass)', function (): void {
    $user = User::factory()->create();
    $user->assignRole('super_admin');

    $this->actingAs($user, 'sanctum')->getJson('/test/moderator/reports')->assertOk();
    $this->actingAs($user, 'sanctum')->getJson('/test/admin/users')->assertOk();
    $this->actingAs($user, 'sanctum')->getJson('/test/auditor/audit-logs')->assertOk();
});

it('blocks a suspended super_admin (status gate beats role bypass)', function (): void {
    $user = User::factory()->create(['status' => 'suspended']);
    $user->assignRole('super_admin');

    $this->actingAs($user, 'sanctum')
        ->getJson('/test/admin/users')
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
});

it('blocks a soft-deleted super_admin (trash gate beats role bypass)', function (): void {
    $user = User::factory()->create();
    $user->assignRole('super_admin');
    $user->delete();

    $this->actingAs($user, 'sanctum')
        ->getJson('/test/admin/users')
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
});

it('lets a system role access every gated route (bypass)', function (): void {
    $user = User::factory()->create();
    $user->assignRole('system');

    $this->actingAs($user, 'sanctum')->getJson('/test/moderator/reports')->assertOk();
    $this->actingAs($user, 'sanctum')->getJson('/test/admin/users')->assertOk();
});

it('returns 401 for an unauthenticated caller on a gated route', function (): void {
    $resp = $this->getJson('/test/moderator/reports');

    $resp->assertStatus(401)->assertJsonPath('code', 'UNAUTHORIZED');
});

it('auditor can view audit logs but is blocked from mutating actions (read-only)', function (): void {
    $user = User::factory()->create();
    $user->assignRole('auditor');

    $this->actingAs($user, 'sanctum')
        ->getJson('/test/auditor/audit-logs')
        ->assertOk();

    $this->actingAs($user, 'sanctum')
        ->getJson('/test/moderator/reports')
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
    $this->actingAs($user, 'sanctum')
        ->getJson('/test/admin/users')
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
});
