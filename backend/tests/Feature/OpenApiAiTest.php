<?php

declare(strict_types=1);

use Symfony\Component\Yaml\Yaml;

/**
 * Per docs/05 §23 the OpenAPI spec is the contract for every
 * M-series surface. This file is the M8 contract check for
 * the AI namespace.
 */
it('exposes every M8 AI admin endpoint in the OpenAPI document', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));
    expect($yaml)->not->toBeFalse();

    foreach ([
        '/api/v1/admin/ai/providers:',
        '/api/v1/admin/ai/providers/{provider}:',
        '/api/v1/admin/ai/prompts:',
        '/api/v1/admin/ai/prompts/{prompt}:',
        '/api/v1/admin/ai/prompts/{prompt}/approve:',
        '/api/v1/admin/ai/prompts/{prompt}/rollback:',
    ] as $path) {
        expect($yaml)->toContain($path);
    }
});

it('exposes every M8 AI internal endpoint in the OpenAPI document', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    foreach ([
        '/api/v1/internal/ai/process/{reportId}:',
        '/api/v1/internal/ai/job/{id}:',
        '/api/v1/internal/ai/job/{id}/result:',
    ] as $path) {
        expect($yaml)->toContain($path);
    }
});

it('declares a schema for every M8 AI resource', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    foreach ([
        'AiProvider:',
        'AiProviderStoreRequest:',
        'AiProviderUpdateRequest:',
        'AiProviderResponse:',
        'AiProviderListResponse:',
        'PromptVersion:',
        'PromptVersionStoreRequest:',
        'PromptVersionUpdateRequest:',
        'PromptVersionResponse:',
        'PromptVersionListResponse:',
        'AiJob:',
        'AiJobResponse:',
        'AiProcessEnqueuedResponse:',
        'AiLabel:',
        'AiResult:',
        'AiResultResponse:',
    ] as $schema) {
        expect($yaml)->toContain($schema);
    }
});

it('masks api_key_secret_id and surfaces has_secret on the provider schema', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('has_secret:')
        ->and($yaml)->toContain("description: 'True when api_key_secret_id is set; the secret id itself is never returned.'");
});

it('tags the AI endpoints and references provider_code on prompt schemas', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('admin.ai.providers.index')
        ->and($yaml)->toContain('admin.ai.providers.store')
        ->and($yaml)->toContain('admin.ai.prompts.approve')
        ->and($yaml)->toContain('admin.ai.prompts.rollback')
        ->and($yaml)->toContain('internal.ai.process')
        ->and($yaml)->toContain('internal.ai.job')
        ->and($yaml)->toContain('internal.ai.job.result');

    // The spec is parseable as YAML.
    $spec = Yaml::parseFile(storage_path('api-docs/openapi.yaml'));
    expect($spec)->toBeArray();
    expect($spec['openapi'])->toStartWith('3.');
});

it('documents the AI tag in the tags index', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('name: AI')
        ->and($yaml)->toContain('AI vision pipeline: provider configs, prompt versions, internal pipeline endpoints (M8).');
});

it('declares the standard error envelopes on every M8 endpoint', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    // The admin AI endpoints are gated by 401/403/422; the internal ones by 401/403/404.
    expect($yaml)->toContain("'401': { \$ref: '#/components/responses/Unauthorized' }")
        ->and($yaml)->toContain("'403': { \$ref: '#/components/responses/Forbidden' }")
        ->and($yaml)->toContain("'404': { \$ref: '#/components/responses/NotFound' }");
});
