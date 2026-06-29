<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('declares the admin integration endpoints under the Integrations tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/integrations' => ['get', 'post'],
        '/api/v1/admin/integrations/{integration}' => ['get', 'put', 'delete'],
        '/api/v1/admin/integrations/{integration}/restore' => ['post'],
        '/api/v1/admin/integrations/{integration}/health' => ['post'],
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
            if (! in_array('Integrations', $paths[$path][$method]['tags'] ?? [], true)) {
                $missing[] = "tag Integrations on {$method} {$path}";
            }
        }
    }

    expect($missing)->toBe([], 'OpenAPI gaps: '.implode(', ', $missing));
});

it('declares the integration schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $schemas = $doc['components']['schemas'] ?? [];

    foreach (['Integration', 'IntegrationResponse', 'IntegrationListResponse', 'IntegrationStoreRequest', 'IntegrationUpdateRequest'] as $name) {
        $this->assertArrayHasKey($name, $schemas, "Schema {$name} is missing.");
    }
});
