<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Listeners\AiCompletedListener;
use App\Modules\AI\Listeners\ReportEvidenceReadyListener;
use App\Modules\AI\Listeners\ReportSubmittedListener;
use App\Modules\Notifications\Listeners\SecurityEventListener;
use App\Modules\Reports\Events\ReportEvidenceReady;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Listeners\WriteStatusHistory;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Security\Services\SecurityPolicyService;
use App\Modules\Shared\Services\PlatformHeartbeatService;
use App\Modules\Workflow\Listeners\RefreshSlaDueAt;
use Illuminate\Queue\Events\Looping;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
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
        Event::listen(ReportStatusChanged::class, RefreshSlaDueAt::class);

        // M7: wire AI completion -> routing -> assignment -> workflow.
        Event::listen(AiCompleted::class, AiCompletedListener::class);
        // M8: wire report submission (status -> ai_processing) -> vision pipeline.
        Event::listen(ReportStatusChanged::class, ReportSubmittedListener::class);
        // M8: one evidence-ready event is the only AI dispatch boundary.
        Event::listen(ReportEvidenceReady::class, ReportEvidenceReadyListener::class);

        // Module-owned notification fan-out is registered by
        // NotificationsServiceProvider. Keep only the cross-cutting
        // security listener here to avoid duplicate delivery.
        Event::listen(SecurityEvent::class, SecurityEventListener::class);

        // A reachable queue broker does not prove that a worker is alive.
        // Queue::looping fires for every daemon iteration, including workers
        // launched with a comma-separated multi-queue list.
        Queue::looping(static function (Looping $event): void {
            app(PlatformHeartbeatService::class)->touchWorker(
                (string) $event->connectionName,
                (string) $event->queue,
            );
        });

        // session.timeout_minutes security policy overrides the
        // framework session lifetime at boot. Defensive: falls back to
        // the policy default when the row is absent or the table is
        // not yet migrated (e.g. during `migrate`).
        config([
            'session.lifetime' => app(SecurityPolicyService::class)->sessionTimeoutMinutes(),
        ]);
    }
}
