<?php

declare(strict_types=1);

/**
 * T-M12-031 (partial) — OpenAPI contract check for the
 * Super Admin security-policy endpoints (T-M12-010).
 */

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('declares the security-policy endpoints under the Super Admin tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/security-policies' => ['get', 'post'],
        '/api/v1/admin/security-policies/{key}' => ['get', 'put', 'delete'],
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

it('declares the security-policy schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $schemas = $doc['components']['schemas'] ?? [];

    foreach (['SecurityPolicy', 'SecurityPolicyResponse', 'SecurityPolicyListResponse', 'SecurityPolicyUpsertRequest'] as $name) {
        $this->assertArrayHasKey($name, $schemas, "Schema {$name} is missing.");
    }
});
