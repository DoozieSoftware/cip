<?php

declare(strict_types=1);

use App\Modules\Security\Services\DeviceFingerprintService;
use Illuminate\Http\Request;

/**
 * Unit coverage for DeviceFingerprintService (T-M2-018).
 *
 * Per docs/11 §10. The service must:
 *  - read the user-agent and IP from the standard Request API
 *  - read the canvas / webgl / screen / timezone / language
 *    components from dedicated X- headers (and Accept-Language as
 *    a fallback for language)
 *  - return null for any component that is not supplied
 *  - emit a stable SHA-256 hash over the components
 *  - never throw on a request that supplies nothing
 */
beforeEach(function (): void {
    $this->service = app(DeviceFingerprintService::class);
});

it('returns all null components and a hash for a bare request', function (): void {
    // Build a request with no Accept-Language header at all to
    // exercise the "no language supplied" path.
    $request = Request::create('/api/v1/health', 'GET');
    $request->headers->remove('Accept-Language');

    $fp = $this->service->fromRequest($request);

    expect($fp)
        ->toBeArray()
        ->toHaveKeys(['user_agent', 'screen', 'timezone', 'language', 'canvas', 'webgl', 'ip', 'hash'])
        ->and($fp['user_agent'])->toBe('Symfony')
        ->and($fp['screen'])->toBeNull()
        ->and($fp['timezone'])->toBeNull()
        ->and($fp['language'])->toBeNull()
        ->and($fp['canvas'])->toBeNull()
        ->and($fp['webgl'])->toBeNull()
        ->and($fp['ip'])->toBe('127.0.0.1')
        ->and($fp['hash'])->toBeString()
        ->and(strlen($fp['hash']))->toBe(64);
});

it('reads the user-agent and IP from the standard Request API', function (): void {
    $request = Request::create('/api/v1/health', 'GET', server: [
        'HTTP_USER_AGENT' => 'Mozilla/5.0 CIP-Citizen/1.0',
        'REMOTE_ADDR' => '203.0.113.5',
    ]);

    $fp = $this->service->fromRequest($request);

    expect($fp['user_agent'])->toBe('Mozilla/5.0 CIP-Citizen/1.0')
        ->and($fp['ip'])->toBe('203.0.113.5');
});

it('reads client-supplied fingerprint components from X- headers', function (): void {
    $request = Request::create('/api/v1/health', 'GET', server: [
        'HTTP_X_SCREEN' => '1920x1080',
        'HTTP_X_TIMEZONE' => 'Asia/Kolkata',
        'HTTP_X_CANVAS_FINGERPRINT' => 'canvas-abc-123',
        'HTTP_X_WEBGL_FINGERPRINT' => 'webgl-xyz-789',
        'HTTP_X_LANGUAGE' => 'en-IN',
    ]);

    $fp = $this->service->fromRequest($request);

    expect($fp['screen'])->toBe('1920x1080')
        ->and($fp['timezone'])->toBe('Asia/Kolkata')
        ->and($fp['canvas'])->toBe('canvas-abc-123')
        ->and($fp['webgl'])->toBe('webgl-xyz-789')
        ->and($fp['language'])->toBe('en-IN');
});

it('falls back to Accept-Language when X-Language is not supplied', function (): void {
    $request = Request::create('/api/v1/health', 'GET', server: [
        'HTTP_ACCEPT_LANGUAGE' => 'en-IN,en-US;q=0.9,en;q=0.8',
    ]);

    $fp = $this->service->fromRequest($request);

    expect($fp['language'])->toBe('en-IN');
});

it('produces a stable hash for the same inputs', function (): void {
    $request = Request::create('/api/v1/health', 'GET', server: [
        'HTTP_USER_AGENT' => 'CIP-Test/1.0',
        'HTTP_X_SCREEN' => '1366x768',
        'HTTP_X_TIMEZONE' => 'Europe/London',
        'HTTP_X_CANVAS_FINGERPRINT' => 'canvas-1',
        'HTTP_X_WEBGL_FINGERPRINT' => 'webgl-1',
        'HTTP_X_LANGUAGE' => 'en-GB',
        'REMOTE_ADDR' => '10.0.0.1',
    ]);

    $a = $this->service->fromRequest($request);
    $b = $this->service->fromRequest($request);

    expect($a['hash'])->toBe($b['hash']);
});

it('produces a different hash when any component changes', function (): void {
    $base = Request::create('/api/v1/health', 'GET', server: [
        'HTTP_USER_AGENT' => 'CIP-Test/1.0',
        'HTTP_X_SCREEN' => '1366x768',
        'REMOTE_ADDR' => '10.0.0.1',
    ]);

    $tweaked = Request::create('/api/v1/health', 'GET', server: [
        'HTTP_USER_AGENT' => 'CIP-Test/1.0',
        'HTTP_X_SCREEN' => '1920x1080',
        'REMOTE_ADDR' => '10.0.0.1',
    ]);

    $a = $this->service->fromRequest($base);
    $b = $this->service->fromRequest($tweaked);

    expect($a['hash'])->not->toBe($b['hash']);
});

it('treats empty string headers as null so they do not poison the hash', function (): void {
    $explicit = Request::create('/api/v1/health', 'GET', server: [
        'HTTP_X_SCREEN' => '1366x768',
    ]);
    $blank = Request::create('/api/v1/health', 'GET', server: [
        'HTTP_X_SCREEN' => '   ',
    ]);

    $a = $this->service->fromRequest($explicit);
    $b = $this->service->fromRequest($blank);

    expect($a['screen'])->toBe('1366x768')
        ->and($b['screen'])->toBeNull()
        ->and($a['hash'])->not->toBe($b['hash']);
});

it('throws nothing and never raises on completely empty inputs', function (): void {
    $request = new Request;

    $fp = $this->service->fromRequest($request);

    expect($fp['hash'])->toBeString()->and(strlen($fp['hash']))->toBe(64);
});
