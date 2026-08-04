<?php

declare(strict_types=1);

it('allows API preflight requests from a local frontend origin', function (): void {
    $response = $this->call('OPTIONS', '/api/v1/auth/send-otp', server: [
        'HTTP_ORIGIN' => 'http://localhost:5174',
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
        'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,x-request-id',
    ]);

    $response->assertNoContent();
    expect($response->headers->get('Access-Control-Allow-Origin'))->toBe('http://localhost:5174')
        ->and($response->headers->get('Access-Control-Allow-Methods'))->toContain('POST');
});

it('allows API preflight requests from the production SPA origin', function (): void {
    $response = $this->call('OPTIONS', '/api/v1/auth/verify-otp', server: [
        'HTTP_ORIGIN' => 'https://cip.dgisipl.com',
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
    ]);

    $response->assertNoContent();
    expect($response->headers->get('Access-Control-Allow-Origin'))->toBe('https://cip.dgisipl.com');
});

it('does not allow unknown browser origins', function (): void {
    $response = $this->call('OPTIONS', '/api/v1/auth/send-otp', server: [
        'HTTP_ORIGIN' => 'https://example.invalid',
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
    ]);

    expect($response->headers->get('Access-Control-Allow-Origin'))->toBeNull();
});
