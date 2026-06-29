<?php

declare(strict_types=1);

/**
 * T-M12-031 (partial) — OpenAPI contract check for the
 * Super Admin audit-log search endpoint (T-M12-014).
 */

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('declares the admin audit-logs endpoint under the Super Admin tag', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $paths = $doc['paths'] ?? [];

    expect($paths)->toHaveKey('/api/v1/admin/audit-logs');
    $op = $paths['/api/v1/admin/audit-logs']['get'] ?? null;
    expect($op)->not->toBeNull();
    expect($op['tags'] ?? [])->toContain('Super Admin');
});

it('declares the AuditLog + AuditLogListResponse schemas', function (): void {
    $doc = \Symfony\Component\Yaml\Yaml::parseFile(
        base_path('storage/api-docs/openapi.yaml'),
    );
    $schemas = $doc['components']['schemas'] ?? [];

    $this->assertArrayHasKey('AuditLog', $schemas, 'Schema AuditLog is missing.');
    $this->assertArrayHasKey('AuditLogListResponse', $schemas, 'Schema AuditLogListResponse is missing.');
});
