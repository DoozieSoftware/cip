<?php

declare(strict_types=1);
use Symfony\Component\Yaml\Yaml;

it('serves a well-formed OpenAPI YAML on /api/v1/openapi.yaml', function (): void {
    $response = $this->get('/api/v1/openapi.yaml');
    $response->assertStatus(200)
        ->assertHeader('Content-Type', 'application/yaml');

    $body = $response->streamedContent();
    expect($body)->toContain('openapi: 3.0.0')
        ->and($body)->toContain('Civic Intelligence Platform API');
});

it('exposes every M3 admin endpoint in the OpenAPI document', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));
    expect($yaml)->not->toBeFalse();

    foreach ([
        '/api/v1/admin/departments',
        '/api/v1/admin/departments/{department}',
        '/api/v1/admin/settings',
        '/api/v1/admin/settings/{setting}',
        '/api/v1/admin/app-configs',
        '/api/v1/admin/app-configs/{app_config}',
        '/api/v1/admin/app-configs/{app_config}/evaluate',
    ] as $path) {
        expect($yaml)->toContain($path);
    }

    foreach (['get:', 'post:', 'put:', 'delete:'] as $verb) {
        expect($yaml)->toContain($verb);
    }
});

it('declares a schema for every new resource', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    foreach ([
        'Department:',
        'DepartmentResponse:',
        'DepartmentListResponse:',
        'DepartmentStoreRequest:',
        'DepartmentUpdateRequest:',
        'Setting:',
        'SettingResponse:',
        'SettingListResponse:',
        'SettingStoreRequest:',
        'SettingUpdateRequest:',
        'AppConfig:',
        'AppConfigResponse:',
        'AppConfigListResponse:',
        'AppConfigStoreRequest:',
        'AppConfigUpdateRequest:',
        'AppConfigEvaluateResponse:',
        'PaginationMeta:',
    ] as $schema) {
        expect($yaml)->toContain($schema);
    }
});

it('exposes the Departments / Settings / Feature Flags tags', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('name: Departments')
        ->and($yaml)->toContain('name: Settings')
        ->and($yaml)->toContain("name: 'Feature Flags'");
});

it('parses the OpenAPI document as valid YAML', function (): void {
    $data = Yaml::parse(
        file_get_contents(storage_path('api-docs/openapi.yaml'))
    );

    expect($data)->toBeArray()
        ->and($data['openapi'] ?? null)->toBe('3.0.0')
        ->and($data['paths'] ?? [])->toBeArray()
        ->and($data['components']['schemas'] ?? [])->toBeArray()
        ->and($data['tags'] ?? [])->toBeArray();
});
