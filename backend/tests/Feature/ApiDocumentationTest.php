<?php

declare(strict_types=1);

it('serves the API documentation HTML at /api/documentation', function (): void {
    $response = $this->get('/api/documentation');
    $response->assertOk();
    expect($response->getContent())->toContain('swagger-ui');
});

it('serves the OpenAPI spec as application/yaml', function (): void {
    $response = $this->get('/api/v1/openapi.yaml');
    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('yaml');
    $body = $response->streamedContent() ?? $response->getContent();
    expect((string) $body)->toContain('Civic Intelligence Platform API');
});
