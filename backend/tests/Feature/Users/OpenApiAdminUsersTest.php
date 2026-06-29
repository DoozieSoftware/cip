<?php

declare(strict_types=1);

/**
 * T-M12-031 (partial) — OpenAPI contract check for the
 * Super Admin user endpoints.
 *
 * Per `docs/05` §23 the contract is enforced by parsing the
 * YAML and asserting structure. This first slice covers the
 * M12-001 user CRUD.
 */

it('declares a Super Admin tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $tags = collect($doc['tags'] ?? [])->pluck('name')->all();
    expect($tags)->toContain('Super Admin');
});

it('declares the six admin user endpoints under the Super Admin tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/users' => ['get', 'post'],
        '/api/v1/admin/users/{user}' => ['get', 'put', 'delete'],
        '/api/v1/admin/users/{user}/restore' => ['post'],
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

    expect($missing)->toBe([], "OpenAPI gaps: " . implode(', ', $missing));
});

it('declares the UserStoreRequest, UserUpdateRequest, UserListResponse schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $schemas = $doc['components']['schemas'] ?? [];
    expect($schemas)->toHaveKey('UserStoreRequest');
    expect($schemas)->toHaveKey('UserUpdateRequest');
    expect($schemas)->toHaveKey('UserListResponse');
    expect($schemas)->toHaveKey('UserResponse');
});

it('the UserStoreRequest requires mobile', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $required = $doc['components']['schemas']['UserStoreRequest']['required'] ?? [];
    expect($required)->toContain('mobile');
});
