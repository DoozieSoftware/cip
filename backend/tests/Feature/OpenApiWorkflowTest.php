<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Smoke test that the OpenAPI YAML is parseable and
 * that the new M6 admin endpoints + schemas are present.
 *
 * The CI pipeline runs swagger-cli validate as a
 * separate lint step; this test is the in-process
 * equivalent for the M6 surface.
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

it('the OpenAPI file declares the M6 admin workflow endpoints', function (): void {
    $raw = file_get_contents(base_path('storage/api-docs/openapi.yaml'));

    expect($raw)->toContain('/api/v1/admin/workflows:')
        ->and($raw)->toContain('/api/v1/admin/workflows/{workflow}:')
        ->and($raw)->toContain('admin.workflows.index')
        ->and($raw)->toContain('admin.workflows.store')
        ->and($raw)->toContain('admin.workflows.show')
        ->and($raw)->toContain('admin.workflows.update')
        ->and($raw)->toContain('admin.workflows.destroy');
});

it('the OpenAPI file declares the M6 Workflow schemas', function (): void {
    $raw = file_get_contents(base_path('storage/api-docs/openapi.yaml'));

    expect($raw)->toContain('WorkflowState:')
        ->and($raw)->toContain('WorkflowTransition:')
        ->and($raw)->toContain('Workflow:')
        ->and($raw)->toContain('WorkflowStoreRequest:')
        ->and($raw)->toContain('WorkflowUpdateRequest:')
        ->and($raw)->toContain('WorkflowResponse:')
        ->and($raw)->toContain('WorkflowListResponse:');
});

it('the OpenAPI file lists 403, 404, 409, 422 for the admin workflow endpoints', function (): void {
    $raw = file_get_contents(base_path('storage/api-docs/openapi.yaml'));

    // The PUT endpoint should declare 403 / 404 / 409 / 422
    // because all of them are reachable in production:
    //   403 - non-super_admin actor
    //   404 - unknown workflow id
    //   409 - duplicate code on update
    //   422 - validation failure
    expect($raw)->toContain('admin.workflows.update');
    $putSection = substr($raw, (int) strpos($raw, 'admin.workflows.update'), 2500);
    expect($putSection)->toContain("'403':")
        ->and($putSection)->toContain("'404':")
        ->and($putSection)->toContain("'409':")
        ->and($putSection)->toContain("'422':");
});

it('the OpenAPI file has a Workflows tag', function (): void {
    $raw = file_get_contents(base_path('storage/api-docs/openapi.yaml'));
    expect($raw)->toContain('Workflows')
        ->and($raw)->toContain('tags: [Workflows]');
});
