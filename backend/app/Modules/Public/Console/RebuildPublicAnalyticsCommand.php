<?php

declare(strict_types=1);

namespace App\Modules\Public\Console;

use App\Modules\Public\Services\PublicAnalyticsAggregateService;
use Illuminate\Console\Command;

final class RebuildPublicAnalyticsCommand extends Command
{
    protected $signature = 'public:rebuild-analytics {--date= : UTC date in YYYY-MM-DD format}';

    protected $description = 'Rebuild privacy-safe public analytics aggregates for one day';

    public function handle(PublicAnalyticsAggregateService $service): int
    {
        $date = $this->option('date');

        if (is_string($date) && $date !== '' && ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $this->error('The --date option must use YYYY-MM-DD.');

            return self::FAILURE;
        }
        $service->rebuild(is_string($date) && $date !== '' ? $date : null);
        $this->info('Public analytics aggregates rebuilt.');

        return self::SUCCESS;
    }
}
