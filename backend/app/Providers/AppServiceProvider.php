<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Listeners\AiCompletedListener;
use App\Modules\AI\Listeners\ReportMediaUploadedListener;
use App\Modules\AI\Listeners\ReportSubmittedListener;
use App\Modules\Media\Events\ReportMediaUploaded;
use App\Modules\Notifications\Listeners\AiCompletedListener as NotificationsAiCompletedListener;
use App\Modules\Notifications\Listeners\ReportAssignedListener;
use App\Modules\Notifications\Listeners\ReportStatusChangedListener;
use App\Modules\Notifications\Listeners\SecurityEventListener;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Listeners\WriteStatusHistory;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Security\Services\SecurityPolicyService;
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
        // M8: wire report submission (status -> ai_processing) -> vision pipeline.
        Event::listen(ReportStatusChanged::class, ReportSubmittedListener::class);
        // M8: re-arm the vision pipeline once evidence is uploaded (report may
        // have entered ai_processing before its photo/video landed).
        Event::listen(ReportMediaUploaded::class, ReportMediaUploadedListener::class);

        // M9: notification fan-out for platform events. The
        // ReportStatusChanged event is shared with the AI
        // pipeline; the notification listener is a separate
        // subscriber that looks at the actual status and
        // decides whether to push a citizen notification.
        Event::listen(ReportAssigned::class, ReportAssignedListener::class);
        Event::listen(ReportStatusChanged::class, ReportStatusChangedListener::class);
        Event::listen(AiCompleted::class, NotificationsAiCompletedListener::class);
        Event::listen(SecurityEvent::class, SecurityEventListener::class);

        // session.timeout_minutes security policy overrides the
        // framework session lifetime at boot. Defensive: falls back to
        // the policy default when the row is absent or the table is
        // not yet migrated (e.g. during `migrate`).
        config([
            'session.lifetime' => app(SecurityPolicyService::class)->sessionTimeoutMinutes(),
        ]);
    }
}
