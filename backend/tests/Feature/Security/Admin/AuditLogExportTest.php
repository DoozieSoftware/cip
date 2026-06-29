<?php

declare(strict_types=1);

/**
 * T-M12-034 — Audit log search / export contract.
 *
 * Per `docs/11` §31 the audit log is the platform's
 * tamper-proof compliance trail. The export story
 * relies on the same JSON endpoint that the audit-log
 * search UI consumes — the export is a thin
 * client-side projection over the filtered result set.
 *
 * This test pins the contract that the search endpoint
 * honors, so a future "CSV export" feature can be
 * added without breaking the existing UI:
 *
 *  - the response is paginated with `per_page` capped at
 *    `AuditLogController::MAX_PER_PAGE` (500)
 *  - `date_from` and `date_to` compose as a window
 *  - `entity`, `action`, `user_id`, `ip` filters compose
 *  - the response includes a `total` meta field so a
 *    client can drive an "Export N rows" CTA
 *  - non-auditor / non-admin callers are denied (403)
 *  - unauthenticated callers are denied (401)
 */

use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // Seed the three roles the audit endpoints gate against.
    foreach (['super_admin', 'auditor', 'department_admin', 'citizen'] as $name) {
        Role::findOrCreate($name, 'web');
    }
});

function auditAdmin(): User
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');
    return $u;
}

function auditCitizen(): User
{
    $u = User::factory()->create();
    $u->assignRole('citizen');
    return $u;
}

it('returns 401 for unauthenticated callers', function (): void {
    $this->getJson('/api/v1/admin/audit-logs')
        ->assertStatus(401);
});

it('returns 403 for non-admin / non-auditor callers', function (): void {
    $citizen = auditCitizen();
    $this->actingAs($citizen, 'sanctum')
        ->getJson('/api/v1/admin/audit-logs')
        ->assertStatus(403);
});

it('returns paginated rows with a total meta field', function (): void {
    $admin = auditAdmin();

    // Seed 12 audit rows.
    for ($i = 0; $i < 12; $i++) {
        AuditLog::create([
            'user_id' => $admin->id,
            'action' => 'report.update',
            'entity' => 'reports',
            'entity_id' => "r-{$i}",
            'ip' => '10.0.0.1',
        ]);
    }

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/audit-logs?per_page=5');

    $response->assertOk();
    $body = $response->json();
    expect($body)->toHaveKey('data');
    expect($body['data'])->toHaveCount(5);
    expect($body['meta']['total'])->toBe(12);
    expect($body['meta']['per_page'])->toBe(5);
});

it('composes entity, action, user_id, and ip filters together', function (): void {
    $admin = auditAdmin();

    AuditLog::create(['user_id' => $admin->id, 'action' => 'report.update', 'entity' => 'reports', 'entity_id' => 'r-1', 'ip' => '10.0.0.1']);
    AuditLog::create(['user_id' => $admin->id, 'action' => 'report.delete', 'entity' => 'reports', 'entity_id' => 'r-2', 'ip' => '10.0.0.2']);
    AuditLog::create(['user_id' => $admin->id, 'action' => 'user.create', 'entity' => 'users', 'entity_id' => 'u-1', 'ip' => '10.0.0.1']);

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/audit-logs?entity=reports&action=report.update&user_id=' . $admin->id . '&ip=10.0.0.1');

    $response->assertOk();
    $body = $response->json();
    expect($body['data'])->toHaveCount(1);
    expect($body['data'][0]['action'])->toBe('report.update');
    expect($body['data'][0]['entity_id'])->toBe('r-1');
});

it('honours the date_from and date_to window', function (): void {
    $admin = auditAdmin();

    $old = AuditLog::create(['user_id' => $admin->id, 'action' => 'report.update', 'entity' => 'reports', 'entity_id' => 'r-old', 'created_at' => '2026-01-01 00:00:00']);
    $new = AuditLog::create(['user_id' => $admin->id, 'action' => 'report.update', 'entity' => 'reports', 'entity_id' => 'r-new', 'created_at' => '2026-06-15 00:00:00']);

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/audit-logs?date_from=2026-06-01&date_to=2026-06-30');

    $response->assertOk();
    $body = $response->json();
    expect(collect($body['data'])->pluck('entity_id'))->toContain('r-new');
    expect(collect($body['data'])->pluck('entity_id'))->not->toContain('r-old');
});

it('caps per_page at 500 (the export cap)', function (): void {
    $admin = auditAdmin();

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/audit-logs?per_page=10000');

    $response->assertOk();
    $body = $response->json();
    expect($body['meta']['per_page'])->toBeLessThanOrEqual(500);
});

it('returns an empty data array when no rows match', function (): void {
    $admin = auditAdmin();

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/audit-logs?entity=does_not_exist');

    $response->assertOk();
    $body = $response->json();
    expect($body['data'])->toBe([]);
    expect($body['meta']['total'])->toBe(0);
});
