<?php

declare(strict_types=1);

namespace App\Modules\Media\Contracts;

/**
 * Pluggable virus scanner for the M5 media pipeline.
 *
 * Per docs/11 §32 (File Security) every uploaded asset must
 * clear a virus scan before it can be marked as
 * `scan_verdict = CLEAN`. The contract is intentionally tiny
 * so swapping in a real ClamAV / VirusTotal / Defender client
 * later is a one-line binding change in
 * `MediaServiceProvider::register()`.
 *
 * Implementations:
 *   - LogScanner      : default in V1; always returns true and
 *                       writes a structured log line
 *   - ClamAvScanner   : shell-out to `clamscan` (stub in M5;
 *                       the full streaming + verdict parsing
 *                       is added in M16 hardening)
 */
interface VirusScanServiceInterface
{
    /**
     * Scan the file at `$path`. Implementations MUST NOT throw
     * on a "infected" verdict — they return `false` instead so
     * the calling service can decide whether to quarantine
     * (default) or hard-delete. Throwing is reserved for
     * infrastructure failures (binary missing, permissions,
     * etc.) that prevent the scan from running.
     */
    public function scan(string $path): bool;

    /**
     * Human-readable name of the scanner implementation
     * (e.g. "log", "clamav"). Stored on the media row's
     * `metadata.scanner` field for audit traceability.
     */
    public function name(): string;
}
