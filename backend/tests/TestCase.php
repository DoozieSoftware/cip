<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

abstract class TestCase extends BaseTestCase
{
    /**
     * Prepare the canonical RBAC fixtures after Laravel's database traits
     * have prepared the test connection.
     *
     * Feature tests exercise system and workflow actors across many files;
     * keeping this bootstrap here prevents a test that rolls back or clears
     * Spatie's tables from causing a later serial test to fail with a
     * RoleDoesNotExist cascade. The full permission matrix remains opt-in via
     * RolesAndPermissionsSeeder in tests that exercise permissions.
     */
    protected function setUp(): void
    {
        parent::setUp();

        if (Schema::hasTable('roles')) {
            foreach ([
                'auditor',
                'citizen',
                'department_admin',
                'department_officer',
                'moderator',
                'super_admin',
                'system',
            ] as $name) {
                Role::query()->firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            }

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }
}
