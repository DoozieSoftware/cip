<?php

declare(strict_types=1);

namespace App\Modules\Media\Providers;

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use App\Modules\Media\Policies\MediaPolicy;
use App\Modules\Media\Services\ClamAvScanner;
use App\Modules\Media\Services\NullScanner;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Media module service provider.
 *
 * Binds the VirusScanServiceInterface to the implementation
 * named by `config('cip.media.scanner')` (env: CIP_MEDIA_SCANNER).
 *
 *   - clamav  : ClamAvScanner  (shells out to clamscan binary)
 *   - none    : NullScanner    (skip scanning — not recommended)
 */
class MediaServiceProvider extends ServiceProvider
{
    /**
     * @var array<string, class-string<VirusScanServiceInterface>>
     */
    public const SCANNERS = [
        'clamav' => ClamAvScanner::class,
        'none' => NullScanner::class,
    ];

    public function register(): void
    {
        $this->app->singleton(VirusScanServiceInterface::class, function (): VirusScanServiceInterface {
            $raw = config('cip.media.scanner', 'clamav');
            $driver = is_string($raw) ? $raw : 'clamav';
            $class = self::SCANNERS[$driver] ?? ClamAvScanner::class;

            return new $class;
        });
    }

    public function boot(): void
    {
        Gate::define(
            'viewReportMedia',
            static fn (User $user, Report $report): bool => app(MediaPolicy::class)->viewReport($user, $report),
        );
    }
}
