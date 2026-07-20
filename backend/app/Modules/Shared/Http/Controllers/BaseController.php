<?php

declare(strict_types=1);

namespace App\Modules\Shared\Http\Controllers;

use App\Modules\Shared\Http\Controllers\Concerns\AuthorizesSuperAdmin;
use App\Modules\Shared\Http\Responses\ApiResponse;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Connection;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

abstract class BaseController extends Controller
{
    use AuthorizesRequests;
    use AuthorizesSuperAdmin;
    use ValidatesRequests;

    /**
     * @param  array<string, mixed>  $meta
     */
    public function respond(mixed $data = null, string $message = 'OK', int $status = 200, array $meta = []): JsonResponse
    {
        return ApiResponse::success($data, $message, $status, $meta);
    }

    /**
     * @param  array<string, mixed>  $errors
     */
    public function respondError(string $message, int $status = 400, ?string $code = null, array $errors = []): JsonResponse
    {
        return ApiResponse::error($message, $status, $code, $errors);
    }

    /**
     * @param  LengthAwarePaginator<array-key, mixed>  $paginator
     */
    public function respondPaginated(LengthAwarePaginator $paginator, string $message = 'OK'): JsonResponse
    {
        return ApiResponse::paginated($paginator, $message);
    }

    /**
     * Resolve and clamp the `per_page` query parameter for a paginated
     * endpoint. Falls back to $default when absent and bounds the value
     * to [$min, $max] so a caller cannot request an unbounded page size.
     */
    protected function perPage(Request $request, int $default = 25, int $max = 200, int $min = 1): int
    {
        return max($min, min($max, (int) $request->query('per_page', (string) $default)));
    }

    protected function traceId(Request $request): string
    {
        $attr = $request->attributes->get('trace_id');

        if (is_string($attr) && $attr !== '') {
            return $attr;
        }
        $header = $request->header('X-Request-Id');

        if (is_string($header) && $header !== '') {
            return $header;
        }

        return 'unknown';
    }

    /**
     * @template T
     *
     * @param  callable():T  $callback
     * @return T
     */
    protected function withTransaction(callable $callback): mixed
    {
        /** @var T $result */
        $result = DB::transaction(static function (Connection $connection) use ($callback): mixed {
            return $callback();
        });

        return $result;
    }
}
