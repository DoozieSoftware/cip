<?php

declare(strict_types=1);

it('exposes a live health endpoint with 200 status', function (): void {
    $response = $this->getJson('/api/v1/health');
    $response->assertOk();
    $body = $response->json();
    expect($body['success'])->toBeTrue();
    expect($body['data']['status'])->toBe('ok');
    expect($body['data'])->toHaveKey('service');
    expect($body['data'])->toHaveKey('time');
});

it('exposes a ready health endpoint with 200 or 503', function (): void {
    $response = $this->getJson('/api/v1/health/ready');
    expect($response->status())->toBeIn([200, 503]);
    $body = $response->json();
    expect($body['data'])->toHaveKey('checks');
    expect($body['data']['checks'])->toHaveKeys(['database', 'redis', 'storage', 'queue']);
});
