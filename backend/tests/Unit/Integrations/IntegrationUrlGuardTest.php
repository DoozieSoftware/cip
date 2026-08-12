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

it('rejects non-http schemes, credentials, and non-standard ports', function (string $url): void {
    expect(fn (): null => (new IntegrationUrlGuard)->assertSafe($url))
        ->toThrow(ApiException::class, 'Integration probe URL is not allowed.');
})->with([
    'file:///etc/passwd',
    'ftp://example.com/file',
    'https://user:pass@example.com/api',
    'https://example.com:8080/api',
]);
