<?php

declare(strict_types=1);

/**
 * T-M12-031 (partial) — OpenAPI contract check for the
 * Super Admin report-type endpoints (T-M12-003).
 */

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('declares the admin report-type endpoints under the Super Admin tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/report-types' => ['get', 'post'],
        '/api/v1/admin/report-types/{report_type}' => ['get', 'put', 'delete'],
        '/api/v1/admin/report-types/{report_type}/restore' => ['post'],
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

it('declares the report-type request/response schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $schemas = $doc['components']['schemas'] ?? [];

    foreach (
        [
            'ReportType',
            'ReportTypeResponse',
            'ReportTypeListResponse',
            'ReportTypeStoreRequest',
            'ReportTypeUpdateRequest',
        ] as $name
    ) {
        $this->assertArrayHasKey($name, $schemas, "Schema {$name} is missing.");
    }
});

it('the ReportTypeStoreRequest requires name and code', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $required = $doc['components']['schemas']['ReportTypeStoreRequest']['required'] ?? [];
    expect($required)->toContain('name');
    expect($required)->toContain('code');
});
