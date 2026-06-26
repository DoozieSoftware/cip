<?php

declare(strict_types=1);

namespace App\Modules\Shared\Http\Responses;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ApiResponse
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public static function success(mixed $data = null, string $message = 'OK', int $status = 200, array $meta = []): JsonResponse
    {
        return new JsonResponse([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => self::normalizeMeta($meta),
        ], $status);
    }

    /**
     * @param  LengthAwarePaginator<array-key, mixed>  $paginator
     */
    public static function paginated(LengthAwarePaginator $paginator, string $message = 'OK'): JsonResponse
    {
        return self::success($paginator->items(), $message, 200, [
            'page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $errors
     */
    public static function error(string $message, int $status = 400, ?string $code = null, array $errors = []): JsonResponse
    {
        $payload = [
            'success' => false,
            'message' => $message,
            'errors' => self::normalizeMeta($errors),
            'trace_id' => self::currentTraceId(),
        ];

        if ($code !== null) {
            $payload['code'] = $code;
        }

        return new JsonResponse($payload, $status);
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>|object
     */
    private static function normalizeMeta(array $meta): array|object
    {
        return $meta === [] ? (object) [] : $meta;
    }

    private static function currentTraceId(): string
    {
        $request = request();

        if (! $request instanceof Request) {
            return 'unknown';
        }
        $value = $request->attributes->get('trace_id', $request->header('X-Request-Id', 'unknown'));

        return is_string($value) ? $value : 'unknown';
    }
}
