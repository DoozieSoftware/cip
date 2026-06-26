<?php

declare(strict_types=1);

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use App\Modules\Media\Services\ClamAvScanner;
use App\Modules\Media\Services\LogScanner;
use Illuminate\Support\Facades\Log;

it('LogScanner always returns true (verdict CLEAN)', function (): void {
    $tmp = tempnam(sys_get_temp_dir(), 'cip-vs-');
    file_put_contents($tmp, 'whatever');

    $scanner = new LogScanner;

    expect($scanner->scan($tmp))->toBeTrue();
});

it('LogScanner writes a structured info line to the application log', function (): void {
    Log::spy();

    $tmp = tempnam(sys_get_temp_dir(), 'cip-vs-');
    file_put_contents($tmp, 'whatever');

    $scanner = new LogScanner;
    $scanner->scan($tmp);

    Log::shouldHaveReceived('info')
        ->withArgs(function (string $message, array $ctx): bool {
            return $message === 'media.virus_scan.log_scanner'
                && ($ctx['scanner'] ?? null) === 'log'
                && ($ctx['verdict'] ?? null) === 'CLEAN'
                && is_string($ctx['path'] ?? null)
                && is_int($ctx['size'] ?? null);
        })
        ->once();
});

it('LogScanner reports its name as "log"', function (): void {
    expect((new LogScanner)->name())->toBe('log');
});

it('binds VirusScanServiceInterface to LogScanner by default (acceptance)', function (): void {
    $resolved = app(VirusScanServiceInterface::class);

    expect($resolved)->toBeInstanceOf(LogScanner::class);
});

it('can be rebound to ClamAvScanner via config("cip.media.scanner")', function (): void {
    config(['cip.media.scanner' => 'clamav']);

    // Forget the singleton so the new binding takes effect.
    app()->forgetInstance(VirusScanServiceInterface::class);

    $resolved = app(VirusScanServiceInterface::class);

    expect($resolved)->toBeInstanceOf(ClamAvScanner::class);
});

it('falls back to LogScanner for an unknown driver name', function (): void {
    config(['cip.media.scanner' => 'mystery']);

    app()->forgetInstance(VirusScanServiceInterface::class);

    $resolved = app(VirusScanServiceInterface::class);

    expect($resolved)->toBeInstanceOf(LogScanner::class);
});
