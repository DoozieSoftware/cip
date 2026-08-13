<?php

declare(strict_types=1);

use App\Modules\Integrations\Services\IntegrationUrlGuard;
use App\Modules\Shared\Exceptions\ApiException;

it('rejects loopback, private, link-local, and metadata probe targets', function (string $url): void {
    expect(fn (): null => (new IntegrationUrlGuard)->assertSafe($url))
        ->toThrow(ApiException::class, 'Integration probe');
})->with([
    'http://127.0.0.1/internal',
    'http://10.0.0.1/internal',
    'http://192.168.1.1/internal',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/internal',
]);

it('enforces an explicit connector host allow-list when configured', function (): void {
    $guard = new IntegrationUrlGuard(['api.example.gov.in', '*.trusted.example'], true);

    expect(fn (): null => $guard->assertSafe('https://blocked.example.com/health'))
        ->toThrow(ApiException::class, 'configured allow-list');

    expect(fn (): null => $guard->assertSafe('https://api.example.gov.in/health'))
        ->not->toThrow(ApiException::class);
    expect(fn (): null => $guard->assertSafe('https://ward.trusted.example/health'))
        ->not->toThrow(ApiException::class);
});

it('fails closed when production policy requires a missing allow-list', function (): void {
    $guard = new IntegrationUrlGuard([], true);

    expect(fn (): null => $guard->assertSafe('https://api.example.gov.in/health'))
        ->toThrow(ApiException::class, 'configured allow-list');
});

it('rejects non-http schemes, credentials, and non-standard ports', function (string $url): void {
    expect(fn (): null => (new IntegrationUrlGuard)->assertSafe($url))
        ->toThrow(ApiException::class, 'Integration probe URL is not allowed.');
})->with([
    'file:///etc/passwd',
    'ftp://example.com/file',
    'https://user:pass@example.com/api',
    'https://example.com:8080/api',
]);
