<?php

declare(strict_types=1);

use Symfony\Component\Yaml\Yaml;

/**
 * Coverage for the M2 Authentication namespace in
 * `backend/storage/api-docs/openapi.yaml`. Per docs/05 §23 the
 * spec file is the source of truth for the HTTP surface.
 */
function cipOpenApiDoc(): array
{
    $path = storage_path('api-docs/openapi.yaml');
    expect(file_exists($path))->toBeTrue('openapi.yaml must exist at '.$path);

    return Yaml::parseFile($path);
}

it('declares an Authentication tag', function (): void {
    $doc = cipOpenApiDoc();
    $names = array_column($doc['tags'] ?? [], 'name');

    expect($names)->toContain('Authentication');
});

it('documents all six auth endpoints under /api/v1/auth', function (): void {
    $doc = cipOpenApiDoc();
    $paths = array_keys($doc['paths'] ?? []);

    expect($paths)->toContain('/api/v1/auth/send-otp')
        ->and($paths)->toContain('/api/v1/auth/verify-otp')
        ->and($paths)->toContain('/api/v1/auth/login')
        ->and($paths)->toContain('/api/v1/auth/refresh')
        ->and($paths)->toContain('/api/v1/auth/logout')
        ->and($paths)->toContain('/api/v1/auth/me');
});

it('declares the right HTTP methods per auth endpoint', function (): void {
    $doc = cipOpenApiDoc();

    expect($doc['paths']['/api/v1/auth/send-otp'])->toHaveKey('post')
        ->and($doc['paths']['/api/v1/auth/verify-otp'])->toHaveKey('post')
        ->and($doc['paths']['/api/v1/auth/login'])->toHaveKey('post')
        ->and($doc['paths']['/api/v1/auth/refresh'])->toHaveKey('post')
        ->and($doc['paths']['/api/v1/auth/logout'])->toHaveKey('post')
        ->and($doc['paths']['/api/v1/auth/me'])->toHaveKey('get');
});

it('requires Sanctum bearer auth on the logout and me endpoints', function (): void {
    $doc = cipOpenApiDoc();

    expect($doc['paths']['/api/v1/auth/logout']['post']['security'][0])->toHaveKey('sanctum')
        ->and($doc['paths']['/api/v1/auth/me']['get']['security'][0])->toHaveKey('sanctum');
});

it('does not require auth on the pre-login endpoints', function (): void {
    $doc = cipOpenApiDoc();

    expect($doc['paths']['/api/v1/auth/send-otp']['post'])->not->toHaveKey('security')
        ->and($doc['paths']['/api/v1/auth/verify-otp']['post'])->not->toHaveKey('security')
        ->and($doc['paths']['/api/v1/auth/login']['post'])->not->toHaveKey('security')
        ->and($doc['paths']['/api/v1/auth/refresh']['post'])->not->toHaveKey('security');
});

it('exposes the request and response schemas referenced by the auth paths', function (): void {
    $doc = cipOpenApiDoc();
    $schemas = $doc['components']['schemas'] ?? [];

    expect($schemas)->toHaveKeys([
        'SendOtpRequest', 'SendOtpResponse',
        'VerifyOtpRequest', 'VerifyOtpResponse',
        'LoginRequest',
        'RefreshTokenRequest', 'RefreshTokenResponse',
        'LogoutResponse', 'User', 'UserResponse',
        'ApiResponse', 'ErrorResponse',
    ]);
});

it('declares the shared 401, 422, and 429 responses', function (): void {
    $doc = cipOpenApiDoc();
    $responses = $doc['components']['responses'] ?? [];

    expect($responses)->toHaveKeys(['Unauthorized', 'ValidationError', 'RateLimited']);
});

it('uses the standard ApiResponse envelope for all auth responses', function (): void {
    $doc = cipOpenApiDoc();
    $schemas = $doc['components']['schemas'];

    expect($schemas['SendOtpResponse'])->toHaveKey('allOf')
        ->and($schemas['VerifyOtpResponse'])->toHaveKey('allOf')
        ->and($schemas['RefreshTokenResponse'])->toHaveKey('allOf')
        ->and($schemas['LogoutResponse'])->toHaveKey('allOf')
        ->and($schemas['UserResponse'])->toHaveKey('allOf');
});

it('serves the openapi.yaml file at /api/v1/openapi.yaml', function (): void {
    $this->get('/api/v1/openapi.yaml')
        ->assertOk()
        ->assertHeader('Content-Type', 'application/yaml');
});

it('renders the Swagger UI at /api/documentation', function (): void {
    $response = $this->get('/api/documentation');

    $response->assertOk();
    $html = (string) $response->getContent();
    expect($html)
        ->toContain('openapi') // swagger-ui references the openapiUrl
        ->toContain('/api/v1/openapi.yaml');
});
