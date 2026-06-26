<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Baseline roles and permissions for the Civic Intelligence Platform.
 *
 * Per docs/03 §14 (Authorization — Spatie Permission / RBAC) and
 * docs/09 §3 (Supported Roles) + §9 (Roles & Permissions with
 * granular categories):
 *
 *   Roles (V1 baseline; super admin can extend via the Role Builder):
 *     - citizen             : end user submitting reports via the PWA
 *     - moderator           : triage + close reports
 *     - department_officer  : department staff handling assigned reports
 *     - department_admin    : department lead, manages department users
 *     - super_admin         : platform-wide full access
 *     - system              : internal service account (jobs, AI worker)
 *     - auditor             : read-only across the platform
 *
 *   Permission categories (per docs/09 §9):
 *     reports / users / departments / analytics / settings / ai /
 *     workflow / notifications / security / audit / integrations
 *
 * Idempotency:
 *   - `firstOrCreate` is used for every Role and Permission, so the
 *     seeder can be run multiple times without duplicating rows.
 *   - `syncPermissions` ensures the role/permission mapping always
 *     matches the declaration below.
 */
class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        app()['cache']->forget('spatie.permission.cache');

        $permissionsByCategory = $this->permissionMatrix();

        $allPermissions = collect($permissionsByCategory)
            ->flatten(1)
            ->map(fn (string $name): Permission => Permission::query()->firstOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
            ))
            ->keyBy('name');

        $this->ensureRole('citizen', ['web'], []);
        $this->ensureRole('moderator', ['web'], [
            'reports.view', 'reports.assign', 'reports.close', 'reports.merge',
            'media.view',
            'users.view',
            'analytics.view',
            'ai.view', 'ai.review',
            'workflow.view',
            'audit.view',
        ]);
        $this->ensureRole('department_officer', ['web'], [
            'reports.view', 'reports.respond', 'reports.resolve',
            'media.view',
            'analytics.view_department',
        ]);
        $this->ensureRole('department_admin', ['web'], [
            'reports.view', 'reports.assign', 'reports.respond', 'reports.close', 'reports.resolve',
            'media.view',
            'users.view_department', 'users.manage_department',
            'analytics.view_department',
            'workflow.view',
        ]);
        $this->ensureRole('super_admin', ['web'], $allPermissions->keys()->all());
        $this->ensureRole('system', ['web'], [
            'reports.view', 'reports.update',
            'media.view', 'media.create',
            'ai.view', 'ai.review', 'ai.train',
            'workflow.execute',
            'notifications.send',
            'integrations.execute',
            'security.view',
        ]);
        $this->ensureRole('auditor', ['web'], [
            'reports.view',
            'media.view',
            'users.view',
            'analytics.view',
            'audit.view',
            'security.view',
            'integrations.view',
        ]);
    }

    /**
     * Build the canonical permission matrix. Categories match the
     * permission categories listed in docs/09 §9.
     *
     * @return array<string, list<string>>
     */
    private function permissionMatrix(): array
    {
        return [
            'reports' => [
                'reports.view', 'reports.view_department', 'reports.view_assigned',
                'reports.create', 'reports.update', 'reports.delete',
                'reports.assign', 'reports.respond', 'reports.close', 'reports.resolve', 'reports.merge',
                'reports.export',
            ],
            'media' => [
                'media.view', 'media.create', 'media.update', 'media.delete',
            ],
            'users' => [
                'users.view', 'users.view_department', 'users.create', 'users.update', 'users.delete',
                'users.manage_department',
            ],
            'departments' => [
                'departments.view', 'departments.create', 'departments.update', 'departments.delete',
            ],
            'analytics' => [
                'analytics.view', 'analytics.view_department', 'analytics.export',
            ],
            'settings' => [
                'settings.view', 'settings.update',
            ],
            'ai' => [
                'ai.view', 'ai.review', 'ai.train', 'ai.configure',
            ],
            'workflow' => [
                'workflow.view', 'workflow.create', 'workflow.update', 'workflow.delete', 'workflow.execute',
            ],
            'notifications' => [
                'notifications.view', 'notifications.send', 'notifications.configure',
            ],
            'security' => [
                'security.view', 'security.manage',
            ],
            'audit' => [
                'audit.view', 'audit.export',
            ],
            'integrations' => [
                'integrations.view', 'integrations.manage', 'integrations.execute',
            ],
        ];
    }

    /**
     * Create or update a role and sync its permission set.
     *
     * @param  list<string>  $guards
     * @param  list<string>  $permissions
     */
    private function ensureRole(string $name, array $guards, array $permissions): Role
    {
        $role = Role::query()->firstOrCreate(
            ['name' => $name, 'guard_name' => $guards[0] ?? 'web'],
        );

        $permissionModels = Permission::query()
            ->whereIn('name', $permissions)
            ->get();

        $role->syncPermissions($permissionModels);

        return $role;
    }
}
