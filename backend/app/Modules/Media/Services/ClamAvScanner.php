<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * ClamAV-backed virus scanner.
 *
 * Shells out to the `clamscan` binary that ships with the
 * platform's ClamAV daemon container (see docs/16 §36).
 *
 *   - binary missing  : throws RuntimeException — surface the
 *                       misconfiguration loudly rather than
 *                       silently let uploads through unscanned
 *   - exit code 0     : CLEAN
 *   - exit code 1     : INFECTED — return false (caller decides
 *                       quarantine / hard-delete)
 *   - exit code >= 2  : ERROR — throw RuntimeException
 */
class ClamAvScanner implements VirusScanServiceInterface
{
    /**
     * @param  string  $binary  path to the clamscan binary
     *                          (defaults to the system PATH
     *                          entry "clamscan")
     */
    public function __construct(private readonly string $binary = 'clamscan') {}

    public function scan(string $path): bool
    {
        if (! is_file($path)) {
            throw new RuntimeException("ClamAvScanner: file not found at {$path}");
        }

        $binary = $this->binary;
        $command = escapeshellcmd($binary).' --no-summary --infected --stdout '.escapeshellarg($path);
        $output = [];
        $exit = 1;
        @exec($command, $output, $exit);

        if ($exit === 0) {
            Log::info('media.virus_scan.clamav', [
                'scanner' => $this->name(),
                'path' => $path,
                'verdict' => 'CLEAN',
            ]);

            return true;
        }

        if ($exit === 1) {
            Log::warning('media.virus_scan.clamav', [
                'scanner' => $this->name(),
                'path' => $path,
                'verdict' => 'INFECTED',
                'output' => $output,
            ]);

            return false;
        }

        throw new RuntimeException(
            "ClamAvScanner: clamscan failed (exit {$exit}) on {$path}: ".
            implode("\n", $output)
        );
    }

    public function name(): string
    {
        return 'clamav';
    }
}
