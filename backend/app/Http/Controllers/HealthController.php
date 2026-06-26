<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;
use Throwable;

class HealthController extends BaseController
{
    #[OA\Get(
        path: '/api/v1/health',
        operationId: 'health.live',
        summary: 'Liveness probe',
        tags: ['Health'],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Service is alive',
                content: new OA\JsonContent(
                    required: ['success', 'message', 'data'],
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'Service is alive'),
                        new OA\Property(
                            property: 'data',
                            required: ['status', 'service', 'time'],
                            properties: [
                                new OA\Property(property: 'status', type: 'string', example: 'ok'),
                                new OA\Property(property: 'service', type: 'string', example: 'Civic Intelligence Platform'),
                                new OA\Property(property: 'time', type: 'string', format: 'date-time'),
                            ],
                            type: 'object',
                        ),
                        new OA\Property(property: 'meta', type: 'object'),
                    ],
                ),
            ),
        ],
    )]
    public function live(): JsonResponse
    {
        return $this->respond([
            'status' => 'ok',
            'service' => self::asString(config('app.name'), 'Civic Intelligence Platform'),
            'time' => now()->toIso8601String(),
        ], 'Service is alive', 200);
    }

    #[OA\Get(
        path: '/api/v1/health/ready',
        operationId: 'health.ready',
        summary: 'Readiness probe with per-component checks',
        tags: ['Health'],
        responses: [
            new OA\Response(
                response: 200,
                description: 'All components ready',
                content: new OA\JsonContent(
                    required: ['success', 'message', 'data'],
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'All components ready'),
                        new OA\Property(
                            property: 'data',
                            required: ['status', 'checks'],
                            properties: [
                                new OA\Property(property: 'status', type: 'string', enum: ['ready', 'degraded']),
                                new OA\Property(
                                    property: 'checks',
                                    type: 'object',
                                    additionalProperties: new OA\AdditionalProperties(
                                        required: ['ok', 'message'],
                                        properties: [
                                            new OA\Property(property: 'ok', type: 'boolean'),
                                            new OA\Property(property: 'message', type: 'string'),
                                        ],
                                    ),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 503,
                description: 'One or more components unhealthy',
                content: new OA\JsonContent(
                    required: ['success', 'message', 'data'],
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'One or more components unhealthy'),
                    ],
                ),
            ),
        ],
    )]
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
