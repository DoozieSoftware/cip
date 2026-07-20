<?php

declare(strict_types=1);

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use App\Modules\Media\Services\NullScanner;

/**
 * NullScanner is the explicit "skip scanning" implementation
 * opted into via CIP_MEDIA_SCANNER=none. It must always return
 * a CLEAN verdict and identify itself honestly as "none" so the
 * media row's `metadata.scanner` audit field records the skip.
 */
it('NullScanner returns true (skips scanning) for any path', function (): void {
    $scanner = new NullScanner;

    expect($scanner->scan('/does/not/exist'))->toBeTrue()
        ->and($scanner->scan(''))->toBeTrue();
});

it('NullScanner returns true even for a real file with content', function (): void {
    $tmp = tempnam(sys_get_temp_dir(), 'cip-null-');
    file_put_contents($tmp, 'arbitrary bytes');

    expect((new NullScanner)->scan($tmp))->toBeTrue();

    @unlink($tmp);
});

it('NullScanner reports its name as "none"', function (): void {
    expect((new NullScanner)->name())->toBe('none');
});

it('NullScanner honours the VirusScanServiceInterface contract', function (): void {
    expect(new NullScanner)->toBeInstanceOf(VirusScanServiceInterface::class);
});
