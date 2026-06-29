<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('declares the media storage endpoints under the MediaStorage tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/media/storage' => ['get', 'put'],
        '/api/v1/admin/media/storage/probe' => ['post'],
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
            if (! in_array('MediaStorage', $paths[$path][$method]['tags'] ?? [], true)) {
                $missing[] = "tag MediaStorage on {$method} {$path}";
            }
        }
    }

    expect($missing)->toBe([], 'OpenAPI gaps: '.implode(', ', $missing));
});

it('declares the media storage schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $schemas = $doc['components']['schemas'] ?? [];

    foreach (['MediaStorage', 'MediaStorageResponse', 'MediaStorageUpdateRequest', 'MediaStorageProbeResponse'] as $name) {
        $this->assertArrayHasKey($name, $schemas, "Schema {$name} is missing.");
    }
});
