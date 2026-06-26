<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use Illuminate\Support\Facades\Log;

/**
 * Default virus scanner for the M5 pipeline.
 *
 * Always returns `true` (CLEAN) and writes a structured log
 * line with the path, size, and current scanner name. The
 * default keeps the rest of the pipeline wired and testable
 * in environments where ClamAV is not installed. Production
 * deployments set `CIP_MEDIA_SCANNER=clamav` in `.env` to swap
 * to the real scanner via MediaServiceProvider.
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
}
