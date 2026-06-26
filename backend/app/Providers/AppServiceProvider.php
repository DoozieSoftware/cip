<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Listeners\AiCompletedListener;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Listeners\WriteStatusHistory;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Wire the Reports event -> listener mapping explicitly so
        // the test suite (and any future auto-discovery change)
        // does not silently lose the status-history write.
        Event::listen(ReportStatusChanged::class, WriteStatusHistory::class);

        // M7: wire AI completion -> routing -> assignment -> workflow.
        Event::listen(AiCompleted::class, AiCompletedListener::class);
    }
}
