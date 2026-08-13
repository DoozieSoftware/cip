<?php

declare(strict_types=1);

namespace App\Modules\Shared\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Records liveness from the long-running queue worker and scheduler.
 *
 * A queue connection probe only proves that the broker is reachable; it does
 * not prove that a worker is consuming jobs. These short-lived cache records
 * provide that missing piece without adding another database table.
 */
class PlatformHeartbeatService
{
    private const WORKER_PREFIX = 'cip:health:heartbeat:worker:';

    private const SCHEDULER_KEY = 'cip:health:heartbeat:scheduler';

    /** @var array<string, int> */
    private static array $lastWorkerTouch = [];

    private static ?int $lastSchedulerTouch = null;

    /**
     * Touch every queue represented by a queue worker loop. Laravel passes a
     * comma-separated queue list for a multi-queue worker.
     */
    public function touchWorker(string $connection, string $queue): void
    {
        $now = (int) now()->timestamp;

        foreach (array_filter(array_map('trim', explode(',', $queue))) as $queueName) {
            $key = $this->workerKey($connection, $queueName);
            $lastTouch = self::$lastWorkerTouch[$key] ?? 0;
            $interval = $this->writeInterval();

            if ($now - $lastTouch < $interval) {
                continue;
            }

            try {
                Cache::put($key, ['touched_at' => $now], $this->ttl());
                self::$lastWorkerTouch[$key] = $now;
            } catch (Throwable $e) {
                Log::warning('Platform worker heartbeat could not be written.', [
                    'connection' => $connection,
                    'queue' => $queueName,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    public function touchScheduler(): void
    {
        $now = (int) now()->timestamp;

        if ($now - (self::$lastSchedulerTouch ?? 0) < $this->writeInterval()) {
            return;
        }

        try {
            Cache::put(self::SCHEDULER_KEY, ['touched_at' => $now], $this->ttl());
            self::$lastSchedulerTouch = $now;
        } catch (Throwable $e) {
            Log::warning('Platform scheduler heartbeat could not be written.', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * @return array{ok: bool, message: string, age_seconds?: int}
     */
    public function workerStatus(): array
    {
        $connection = $this->queueConnection();

        if (in_array($connection, ['sync', 'null'], true)) {
            return ['ok' => true, 'message' => "not required (queue:{$connection})"];
        }

        return $this->statusForKeys(
            array_map(fn (string $queue): string => $this->workerKey($connection, $queue), $this->requiredQueues()),
            'worker',
        );
    }

    /**
     * @return array{ok: bool, message: string, age_seconds?: int}
     */
    public function schedulerStatus(): array
    {
        return $this->statusForKeys([self::SCHEDULER_KEY], 'scheduler');
    }

    /**
     * @param  list<string>  $keys
     * @return array{ok: bool, message: string, age_seconds?: int}
     */
    private function statusForKeys(array $keys, string $component): array
    {
        $oldestAge = 0;

        try {
            foreach ($keys as $key) {
                $heartbeat = Cache::get($key);
                $touchedAt = is_array($heartbeat) ? $heartbeat['touched_at'] ?? null : null;

                if (! is_int($touchedAt) && ! (is_numeric($touchedAt) && (int) $touchedAt > 0)) {
                    return ['ok' => false, 'message' => "{$component} heartbeat missing"];
                }

                $age = max(0, (int) now()->timestamp - (int) $touchedAt);
                $oldestAge = max($oldestAge, $age);

                if ($age > $this->ttl()) {
                    return [
                        'ok' => false,
                        'message' => "{$component} heartbeat stale ({$age}s)",
                        'age_seconds' => $age,
                    ];
                }
            }
        } catch (Throwable $e) {
            return ['ok' => false, 'message' => "{$component} heartbeat unavailable"];
        }

        return [
            'ok' => true,
            'message' => "{$component} heartbeat current",
            'age_seconds' => $oldestAge,
        ];
    }

    private function workerKey(string $connection, string $queue): string
    {
        $safeConnection = preg_replace('/[^A-Za-z0-9_.-]/', '_', $connection) ?: 'unknown';
        $safeQueue = preg_replace('/[^A-Za-z0-9_.-]/', '_', $queue) ?: 'default';

        return self::WORKER_PREFIX.$safeConnection.':'.$safeQueue;
    }

    private function queueConnection(): string
    {
        $connection = config('queue.default');

        return is_string($connection) && $connection !== '' ? $connection : 'sync';
    }

    /** @return list<string> */
    private function requiredQueues(): array
    {
        $configured = config('cip.health.required_queues', 'media,ai,notifications,default');
        $queues = is_string($configured) ? array_filter(array_map('trim', explode(',', $configured))) : [];

        return array_values($queues !== [] ? $queues : ['default']);
    }

    private function ttl(): int
    {
        $value = config('cip.health.heartbeat_ttl_seconds', 180);

        return max(30, is_numeric($value) ? (int) $value : 180);
    }

    private function writeInterval(): int
    {
        $value = config('cip.health.heartbeat_write_interval_seconds', 15);

        return max(1, is_numeric($value) ? (int) $value : 15);
    }
}
