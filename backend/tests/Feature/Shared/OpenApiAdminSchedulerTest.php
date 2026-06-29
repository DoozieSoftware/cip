<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('declares the scheduler endpoints under the Scheduler tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/scheduler/jobs' => ['get'],
        '/api/v1/admin/scheduler/jobs/{id}/run-now' => ['post'],
        '/api/v1/admin/scheduler/jobs/{id}/pause' => ['post'],
        '/api/v1/admin/scheduler/jobs/{id}/resume' => ['post'],
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
            if (! in_array('Scheduler', $paths[$path][$method]['tags'] ?? [], true)) {
                $missing[] = "tag Scheduler on {$method} {$path}";
            }
        }
    }

    expect($missing)->toBe([], 'OpenAPI gaps: '.implode(', ', $missing));
});

it('declares the scheduler schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $schemas = $doc['components']['schemas'] ?? [];

    foreach (['SchedulerJob', 'SchedulerJobsResponse', 'SchedulerRunNowResponse', 'SchedulerPauseResponse'] as $name) {
        $this->assertArrayHasKey($name, $schemas, "Schema {$name} is missing.");
    }
});

it('declares the organization endpoints under the Organizations tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/organizations' => ['get', 'post'],
        '/api/v1/admin/organizations/{organization}' => ['get', 'put', 'delete'],
        '/api/v1/admin/organizations/{organization}/restore' => ['post'],
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
            if (! in_array('Organizations', $paths[$path][$method]['tags'] ?? [], true)) {
                $missing[] = "tag Organizations on {$method} {$path}";
            }
        }
    }

    expect($missing)->toBe([], 'OpenAPI gaps: '.implode(', ', $missing));
});

it('declares the organization schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $schemas = $doc['components']['schemas'] ?? [];

    foreach (['Organization', 'OrganizationResponse', 'OrganizationListResponse', 'OrganizationStoreRequest', 'OrganizationUpdateRequest'] as $name) {
        $this->assertArrayHasKey($name, $schemas, "Schema {$name} is missing.");
    }
});

it('declares the platform health endpoints under the PlatformHealth tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $paths = $doc['paths'] ?? [];

    $expected = [
        '/api/v1/admin/health' => ['get'],
        '/api/v1/admin/health/components' => ['get'],
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
            if (! in_array('PlatformHealth', $paths[$path][$method]['tags'] ?? [], true)) {
                $missing[] = "tag PlatformHealth on {$method} {$path}";
            }
        }
    }

    expect($missing)->toBe([], 'OpenAPI gaps: '.implode(', ', $missing));
});

it('declares the platform health schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(base_path('storage/api-docs/openapi.yaml'));
    $schemas = $doc['components']['schemas'] ?? [];

    foreach (['HealthComponent', 'PlatformHealthResponse', 'PlatformHealthComponentsResponse'] as $name) {
        $this->assertArrayHasKey($name, $schemas, "Schema {$name} is missing.");
    }
});
