<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('declares the notification-config endpoints under the NotificationConfigs tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/notification-configs' => ['get', 'post'],
        '/api/v1/admin/notification-configs/{config}' => ['get', 'put', 'delete'],
        '/api/v1/admin/notification-configs/{config}/restore' => ['post'],
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
            if (! in_array('NotificationConfigs', $paths[$path][$method]['tags'] ?? [], true)) {
                $missing[] = "tag NotificationConfigs on {$method} {$path}";
            }
        }
    }

    expect($missing)->toBe([], 'OpenAPI gaps: '.implode(', ', $missing));
});

it('declares the notification config schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $schemas = $doc['components']['schemas'] ?? [];

    foreach (['NotificationChannelConfig', 'NotificationChannelConfigResponse', 'NotificationChannelConfigListResponse', 'NotificationChannelConfigStoreRequest', 'NotificationChannelConfigUpdateRequest'] as $name) {
        $this->assertArrayHasKey($name, $schemas, "Schema {$name} is missing.");
    }
});
