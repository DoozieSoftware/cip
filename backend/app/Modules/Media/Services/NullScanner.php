<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Contracts\VirusScanServiceInterface;

/**
 * No-op virus scanner — explicitly skips scanning.
 *
 * Use only when ClamAV is intentionally not installed
 * (e.g. local dev without the binary). This does not pretend
 * to scan — it is an explicit, honest "skip" that must be
 * opted into via CIP_MEDIA_SCANNER=none.
 */
class NullScanner implements VirusScanServiceInterface
{
    public function scan(string $path): bool
    {
        return true;
    }

    public function name(): string
    {
        return 'none';
    }
}
