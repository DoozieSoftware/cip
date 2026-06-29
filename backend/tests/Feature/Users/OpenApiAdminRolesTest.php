<?php

declare(strict_types=1);

/**
 * T-M12-031 (partial) — OpenAPI contract check for the
 * Super Admin role + permission endpoints (T-M12-002).
 *
 * Mirrors OpenApiAdminUsersTest but for the role/permission
 * namespace declared by AdminRoleController and
 * AdminPermissionController.
 */

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('declares the admin role endpoints under the Super Admin tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/roles' => ['get', 'post'],
        '/api/v1/admin/roles/{role}' => ['get', 'put', 'delete'],
        '/api/v1/admin/roles/{role}/permissions/sync' => ['post'],
    ];

    $missing = [];
    foreach ($expected as $path => $methods) {
        if (! array_key_exists($path, $paths)) {
            $missing[] = $path;
            continue;
        }
        foreach ($methods as $method) {
            if (! array_key_exists($method, $paths[$path])) {
                $missing[] = "{$method} on {$path}";
                continue;
            }
            if (! in_array('Super Admin', $paths[$path][$method]['tags'] ?? [], true)) {
                $missing[] = "tag Super Admin on {$method} {$path}";
            }
        }
    }

    expect($missing)->toBe([], 'OpenAPI gaps: ' . implode(', ', $missing));
});

it('declares the admin permission endpoints under the Super Admin tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/permissions' => ['get', 'post'],
        '/api/v1/admin/permissions/{permission}' => ['get', 'delete'],
    ];

    $missing = [];
    foreach ($expected as $path => $methods) {
        if (! array_key_exists($path, $paths)) {
            $missing[] = $path;
            continue;
        }
        foreach ($methods as $method) {
            if (! array_key_exists($method, $paths[$path])) {
                $missing[] = "{$method} on {$path}";
                continue;
            }
            if (! in_array('Super Admin', $paths[$path][$method]['tags'] ?? [], true)) {
                $missing[] = "tag Super Admin on {$method} {$path}";
            }
        }
    }

    expect($missing)->toBe([], 'OpenAPI gaps: ' . implode(', ', $missing));
});

it('declares the role + permission request/response schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $schemas = $doc['components']['schemas'] ?? [];

    foreach (
        [
            'Role',
            'RoleResponse',
            'RoleListResponse',
            'RoleStoreRequest',
            'RoleUpdateRequest',
            'RolePermissionsSyncRequest',
            'Permission',
            'PermissionResponse',
            'PermissionListResponse',
            'PermissionStoreRequest',
        ] as $name
    ) {
        $this->assertArrayHasKey($name, $schemas, "Schema {$name} is missing.");
    }
});

it('the RoleStoreRequest requires name', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $required = $doc['components']['schemas']['RoleStoreRequest']['required'] ?? [];
    expect($required)->toContain('name');
});

it('the RolePermissionsSyncRequest requires permissions', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $required = $doc['components']['schemas']['RolePermissionsSyncRequest']['required'] ?? [];
    expect($required)->toContain('permissions');
});
