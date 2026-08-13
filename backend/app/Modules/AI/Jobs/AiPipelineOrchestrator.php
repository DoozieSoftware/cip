<?php

declare(strict_types=1);

namespace App\Modules\AI\Jobs;

use App\Modules\AI\Services\AiPipelineFailureHandler;
use App\Modules\AI\Services\AiPipelineRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Queue boundary for the advisory vision pipeline.
 *
 * The serialized contract intentionally contains only report/evidence identity.
 * Domain phases are coordinated by AiPipelineRunner so retry configuration,
 * queue uniqueness, and Laravel failure callbacks remain separate from analysis.
 */
class AiPipelineOrchestrator implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 40;

    /** @var list<int> */
    public array $backoff = [5, 10, 20, 40, 80, 160, 300, 300, 300, 300];

    public int $timeout = 120;

    public function __construct(
        public readonly string $reportId,
        public ?string $evidenceRevision = null,
    ) {
        $this->onQueue('ai');
    }

    public function handle(AiPipelineRunner $runner): void
    {
        $this->evidenceRevision = $runner->run($this->reportId, $this->evidenceRevision);
    }

    public function failed(?Throwable $exception): void
    {
        app(AiPipelineFailureHandler::class)->handle($this->reportId, $exception);
    }

    public function uniqueId(): string
    {
        return $this->reportId.':'.($this->evidenceRevision ?? 'pending');
    }

    public function uniqueFor(): int
    {
        return 900;
    }

    /** @return list<object> */
    public function middleware(): array
    {
        return [new WithoutOverlapping('ai-report:'.$this->uniqueId())->expireAfter(900)];
    }
}
