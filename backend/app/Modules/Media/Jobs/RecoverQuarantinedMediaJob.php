<?php

declare(strict_types=1);

namespace App\Modules\Media\Jobs;

use App\Modules\Media\Services\MediaQuarantineService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

final class RecoverQuarantinedMediaJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300, 900];

    public int $uniqueFor = 900;

    public function __construct(public readonly string $quarantineId)
    {
        $this->onQueue('media');
    }

    public function handle(MediaQuarantineService $quarantine): void
    {
        $result = $quarantine->recover($this->quarantineId);

        Log::info('media.quarantine.recovery_finished', [
            'quarantine_id' => $this->quarantineId,
            'result' => $result?->value ?? 'SKIPPED',
            'attempt' => $this->attempts(),
        ]);
    }

    public function uniqueId(): string
    {
        return $this->quarantineId;
    }

    /** @return list<string> */
    public function tags(): array
    {
        return ['media', 'media.quarantine', 'quarantine:'.$this->quarantineId];
    }
}
