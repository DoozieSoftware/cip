<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Jobs;

use App\Modules\Integrations\Models\Integration;
use App\Modules\Integrations\Services\IntegrationAdminService;
use App\Modules\Security\Services\SecurityEventService;
use App\Modules\Shared\Support\TraceContext;
use App\Modules\Users\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/** Execute one administrator-requested connector probe outside the HTTP process. */
final class ProbeIntegrationHealthJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 15;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public int $uniqueFor = 60;

    public function __construct(
        public readonly string $integrationId,
        public readonly string $requestedBy,
    ) {
        $queue = app()->bound('config')
            ? app('config')->get('integrations.probe.queue', 'default')
            : 'default';
        $this->onQueue(is_string($queue) && $queue !== '' ? $queue : 'default');
    }

    public function uniqueId(): string
    {
        return $this->integrationId;
    }

    public function handle(IntegrationAdminService $service): void
    {
        $integration = Integration::query()->find($this->integrationId);

        if (! $integration instanceof Integration) {
            return;
        }

        $actor = User::query()->find($this->requestedBy);
        $service->probe($integration, $actor instanceof User ? $actor : null);
    }

    public function failed(?Throwable $exception): void
    {
        app(SecurityEventService::class)->recordSafe(
            'integration.probe.failed',
            SecurityEventService::SEVERITY_WARNING,
            [
                'integration_id' => $this->integrationId,
                'requested_by' => $this->requestedBy,
                'trace_id' => TraceContext::id(),
                'error_type' => $exception !== null ? $exception::class : null,
            ],
        );
    }
}
