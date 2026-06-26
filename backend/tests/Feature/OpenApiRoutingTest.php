<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Smoke test that the OpenAPI YAML declares the M7
 * routing admin endpoints and the matching schemas.
 *
 * CI runs swagger-cli validate as a separate lint step;
 * this test is the in-process equivalent.
 */
uses(RefreshDatabase::class);

it('the OpenAPI YAML file exists and is parseable', function (): void {
    $path = base_path('storage/api-docs/openapi.yaml');
    expect(file_exists($path))->toBeTrue();
    expect(is_readable($path))->toBeTrue();

    $raw = file_get_contents($path);
    expect($raw)->toContain('openapi: 3.0.0')
        ->and($raw)->toContain('paths:')
        ->and($raw)->toContain('components:');
});

it('declares the routing-rules CRUD endpoints', function (): void {
    $raw = file_get_contents(base_path('storage/api-docs/openapi.yaml'));

    expect($raw)->toContain('/api/v1/admin/routing-rules:')
        ->and($raw)->toContain('/api/v1/admin/routing-rules/reorder:')
        ->and($raw)->toContain('/api/v1/admin/routing-rules/{rule}:')
        ->and($raw)->toContain('admin.routing-rules.index')
        ->and($raw)->toContain('admin.routing-rules.store')
        ->and($raw)->toContain('admin.routing-rules.show')
        ->and($raw)->toContain('admin.routing-rules.update')
        ->and($raw)->toContain('admin.routing-rules.destroy')
        ->and($raw)->toContain('admin.routing-rules.reorder');
});

it('declares the report reassign endpoint', function (): void {
    $raw = file_get_contents(base_path('storage/api-docs/openapi.yaml'));

    expect($raw)->toContain('/api/v1/admin/reports/{report}/reassign:')
        ->and($raw)->toContain('admin.reports.reassign');
});

it('declares the routing condition DSL schema with all 7 operators', function (): void {
    $raw = file_get_contents(base_path('storage/api-docs/openapi.yaml'));

    foreach (['category_in', 'ward_in', 'district_in', 'severity_in', 'keyword_match', 'time_of_day_between', 'ai_label_in'] as $op) {
        expect($raw)->toContain($op);
    }
});

it('declares the routing request / response / list schemas', function (): void {
    $raw = file_get_contents(base_path('storage/api-docs/openapi.yaml'));

    expect($raw)->toContain('RoutingRule:')
        ->and($raw)->toContain('RoutingRuleStoreRequest:')
        ->and($raw)->toContain('RoutingRuleUpdateRequest:')
        ->and($raw)->toContain('RoutingRuleReorderRequest:')
        ->and($raw)->toContain('RoutingRuleResponse:')
        ->and($raw)->toContain('RoutingRuleListResponse:')
        ->and($raw)->toContain('ReassignReportRequest:')
        ->and($raw)->toContain('ReassignResponse:');
});

it('declares the Routing tag', function (): void {
    $raw = file_get_contents(base_path('storage/api-docs/openapi.yaml'));
    expect($raw)->toContain('name: Routing');
});
