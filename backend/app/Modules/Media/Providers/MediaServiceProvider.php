<?php

declare(strict_types=1);

namespace App\Modules\Media\Providers;

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use App\Modules\Media\Services\ClamAvScanner;
use App\Modules\Media\Services\LogScanner;
use Illuminate\Support\ServiceProvider;

/**
 * Media module service provider.
 *
 * Binds the VirusScanServiceInterface to the implementation
 * named by `config('cip.media.scanner')` (env: CIP_MEDIA_SCANNER).
 * Default = 'log' so dev / test / CI / staging work without
 * ClamAV installed. Production flips to 'clamav'.
 *
 *   - log     : LogScanner     (default — always CLEAN, audited)
 *   - clamav  : ClamAvScanner  (shells out to clamscan binary)
 */
class MediaServiceProvider extends ServiceProvider
{
    /**
     * @var array<string, class-string<VirusScanServiceInterface>>
     */
    public const SCANNERS = [
        'log' => LogScanner::class,
        'clamav' => ClamAvScanner::class,
    ];

    public function register(): void
    {
        $this->app->singleton(VirusScanServiceInterface::class, function (): VirusScanServiceInterface {
            $raw = config('cip.media.scanner', 'log');
            $driver = is_string($raw) ? $raw : 'log';
            $class = self::SCANNERS[$driver] ?? LogScanner::class;

            return new $class;
        });
    }
}
