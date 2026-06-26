<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Throwable;

class HealthController extends BaseController
{
    public function live(): JsonResponse
    {
        return $this->respond([
            'status' => 'ok',
            'service' => self::asString(config('app.name'), 'Civic Intelligence Platform'),
            'time' => now()->toIso8601String(),
        ], 'Service is alive', 200);
    }

    public function ready(): JsonResponse
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'redis' => $this->checkRedis(),
            'storage' => $this->checkStorage(),
            'queue' => $this->checkQueue(),
        ];

        $ok = ! in_array(false, array_column($checks, 'ok'), true);
        $status = $ok ? 200 : 503;
        $message = $ok ? 'All components ready' : 'One or more components unhealthy';

        return $this->respond(
            ['status' => $ok ? 'ready' : 'degraded', 'checks' => $checks],
            $message,
            $status,
        );
    }

    /**
     * @return array{ok: bool, message: string}
     */
    private function checkDatabase(): array
    {
        try {
            DB::connection()->getPdo();

            return ['ok' => true, 'message' => 'connected'];
        } catch (Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * @return array{ok: bool, message: string}
     */
    private function checkRedis(): array
    {
        try {
            Redis::ping();

            return ['ok' => true, 'message' => 'connected'];
        } catch (Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * @return array{ok: bool, message: string}
     */
    private function checkStorage(): array
    {
        try {
            $disk = self::asString(config('filesystems.default'), 'local');
            $store = Storage::disk($disk);

            if (! $store->exists('health-probe')) {
                $store->put('health-probe', 'ok');
            }

            return ['ok' => true, 'message' => "disk:{$disk}"];
        } catch (Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * @return array{ok: bool, message: string}
     */
    private function checkQueue(): array
    {
        try {
            $connection = self::asString(config('queue.default'), 'sync');
            $size = Queue::connection($connection)->size();

            return ['ok' => true, 'message' => "connection:{$connection};size:{$size}"];
        } catch (Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }

    private static function asString(mixed $value, string $fallback): string
    {
        return is_string($value) && $value !== '' ? $value : $fallback;
    }
}
