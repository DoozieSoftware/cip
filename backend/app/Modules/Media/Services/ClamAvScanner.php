<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Symfony\Component\Process\Process;
use Throwable;

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

        $process = new Process([$this->binary, '--no-summary', '--infected', '--stdout', $path]);
        $process->setTimeout(60);
        $process->run();
        $exit = $process->getExitCode();
        $output = trim($process->getOutput()."\n".$process->getErrorOutput());

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
                'output' => $output === '' ? [] : explode("\n", $output),
            ]);

            return false;
        }

        throw new RuntimeException(
            sprintf(
                'ClamAvScanner: clamscan failed (exit %s%s) on %s: %s',
                $exit === null ? 'unknown' : (string) $exit,
                $process->hasBeenSignaled() ? ', signal '.$process->getTermSignal() : '',
                $path,
                $output,
            )
        );
    }

    public function name(): string
    {
        return 'clamav';
    }

    public function healthCheck(): bool
    {
        try {
            // ClamAV includes the loaded official signature serial in its
            // version output (for example `ClamAV 1.4.3/28110/...`). Scanning
            // `/dev/null` is not a valid health probe: cPanel's build rejects
            // device files even when regular-file scanning is healthy.
            $version = new Process([$this->binary, '--version']);
            $version->setTimeout(5);
            $version->run();

            if (! $version->isSuccessful()) {
                return false;
            }

            return preg_match('/^ClamAV\s+[^\s\/]+\/\d+\//', trim($version->getOutput())) === 1;
        } catch (Throwable) {
            return false;
        }
    }
}
