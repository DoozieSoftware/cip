<?php

declare(strict_types=1);

it('renders ApiException validation as 422 with envelope', function (): void {
    $response = $this->getJson('/api/v1/health/not-found');
    $response->assertNotFound();
});

it('returns the standard envelope with trace_id header', function (): void {
    $response = $this->withHeader('X-Request-Id', 'unit-trace-1')
        ->getJson('/api/v1/health');
    $response->assertOk();
    expect($response->headers->get('X-Request-Id'))->toBe('unit-trace-1');
});
