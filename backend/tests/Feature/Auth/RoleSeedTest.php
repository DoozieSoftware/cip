<?php

declare(strict_types=1);

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);


/**
 * Invoke the seeder directly. We avoid the Pest `artisan()` helper
 * here because the test already gets a clean in-memory database
 * via RefreshDatabase and the seeder is the only thing we need to
 * run.
 */
function seedRoles(): void
{
    (new RolesAndPermissionsSeeder)->run();
}

/**
 * Validates the baseline role and permission seeder introduced in T-M2-010.
 *
 * Per docs/03 §14 (Authorization) and docs/09 §3 (Supported Roles) +
 * §9 (Roles & Permissions with granular categories).
 */
it('creates the seven V1 roles', function (): void {
    seedRoles();

    foreach (['citizen', 'moderator', 'department_officer', 'department_admin', 'super_admin', 'system', 'auditor'] as $role) {
        expect(Role::query()->where('name', $role)->exists())->toBeTrue("missing role: {$role}");
    }
});

it('super_admin has every seeded permission', function (): void {
    seedRoles();

    $superAdmin = Role::query()->where('name', 'super_admin')->first();
    expect($superAdmin)->not->toBeNull();

    $all = Permission::query()->pluck('name')->all();

    foreach ($all as $permission) {
        expect($superAdmin->hasPermissionTo($permission))->toBeTrue("super_admin missing: {$permission}");
    }
});

it('citizen has no baseline permissions (created lazily by the report flow)', function (): void {
    seedRoles();

    $citizen = Role::query()->where('name', 'citizen')->first();
    expect($citizen->permissions)->toHaveCount(0);
});

it('moderator has the expected baseline permission set', function (): void {
    seedRoles();

    $moderator = Role::query()->where('name', 'moderator')->first();
    $permissions = $moderator->permissions->pluck('name')->sort()->values()->all();

    expect($permissions)->toEqual(collect([
        'reports.view', 'reports.assign', 'reports.close', 'reports.merge',
        'media.view',
        'users.view',
        'analytics.view',
        'ai.view', 'ai.review',
        'workflow.view',
        'audit.view',
    ])->sort()->values()->all());
});

it('auditor is read-only — no mutating permissions', function (): void {
    seedRoles();

    $auditor = Role::query()->where('name', 'auditor')->first();
    $permissions = $auditor->permissions->pluck('name');

    // No create/update/delete/assign/close/merge/manage/execute/send permissions
    $forbidden = $permissions->filter(fn ($p) => preg_match('/\.(create|update|delete|assign|close|merge|manage|execute|send|respond|resolve|configure|train)$/', $p));
    expect($forbidden->all())->toBe([]);
});

it('is idempotent — running twice does not duplicate roles or permissions', function (): void {
    seedRoles();
    $roleCountFirst = Role::query()->count();
    $permissionCountFirst = Permission::query()->count();

    seedRoles();
    $roleCountSecond = Role::query()->count();
    $permissionCountSecond = Permission::query()->count();

    expect($roleCountSecond)->toBe($roleCountFirst)
        ->and($permissionCountSecond)->toBe($permissionCountFirst);
});

it('groups permissions under the 12 canonical categories', function (): void {
    seedRoles();

    $names = Permission::query()->pluck('name');
    $categories = $names->map(fn (string $n) => explode('.', $n)[0])->unique()->sort()->values()->all();

    expect($categories)->toEqual(collect([
        'reports', 'media', 'users', 'departments', 'analytics',
        'settings', 'ai', 'workflow', 'notifications', 'security',
        'audit', 'integrations',
    ])->sort()->values()->all());
});
