<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use Illuminate\Support\Facades\Log;

/**
 * Log-only virus scanner — TEST/DEV UTILITY.
 *
 * Always returns `true` (CLEAN) and writes a structured log line with
 * the path, size, and current scanner name. The media feature tests
 * bind this implementation to bypass ClamAV; production resolves
 * ClamAvScanner (or NullScanner via CIP_MEDIA_SCANNER=none) through
 * MediaServiceProvider instead. Do not register it in production.
 */
class LogScanner implements VirusScanServiceInterface
{
    public function scan(string $path): bool
    {
        $size = is_file($path) ? (int) @filesize($path) : 0;

        Log::info('media.virus_scan.log_scanner', [
            'scanner' => $this->name(),
            'path' => $path,
            'size' => $size,
            'verdict' => 'CLEAN',
        ]);

        return true;
    }

    public function name(): string
    {
        return 'log';
    }

    public function healthCheck(): bool
    {
        // The log scanner is always "usable" — it performs no real scan.
        return true;
    }
}
