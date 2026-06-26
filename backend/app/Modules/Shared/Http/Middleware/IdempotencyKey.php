<?php

declare(strict_types=1);

namespace App\Modules\Shared\Http\Middleware;

use App\Modules\Reports\Models\IdempotencyKey as IdempotencyKeyModel;
use App\Modules\Shared\Http\Responses\ApiResponse;
use App\Modules\Users\Models\User;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Idempotency-Key middleware per docs/05 §20 and docs/11 §23.
 *
 * Reads the `Idempotency-Key` header on a mutating request. If the
 * key has been seen for the same user + route + request_hash, the
 * stored response is replayed (without re-running the handler). If
 * the same key is reused with a different request_hash, the
 * request is rejected with 409 IDEMPOTENCY_KEY_CONFLICT. Otherwise
 * the handler runs and the response is captured for future replays.
 *
 * The middleware is bound to mutating verbs only (POST / PUT / PATCH /
 * DELETE) — GETs always pass through.
 *
 * Anonymous traffic (no `auth:sanctum` user) gets a 401 from
 * auth before this middleware runs, so user_id is always populated.
 *
 * The (key, user_id) unique constraint is the safety net for the
 * race between two concurrent requests using the same key — the
 * second insert fails with a 23000 SQLSTATE and the middleware
 * treats it as a replay (re-reads the row).
 */
class IdempotencyKey
{
    public const HEADER = 'Idempotency-Key';

    public const CONFLICT_CODE = 'IDEMPOTENCY_KEY_CONFLICT';

    private const MUTATING_VERBS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->getMethod(), self::MUTATING_VERBS, true)) {
            return $next($request);
        }

        $key = $request->header(self::HEADER);

        if (! is_string($key) || $key === '') {
            // No key supplied — pass through. The route contract decides
            // whether keys are required.
            return $next($request);
        }

        $user = $request->user();
        $userId = $user instanceof User ? (string) $user->id : null;
        $route = (string) $request->route()?->getName();
        $requestHash = hash('sha256', (string) $request->getContent());

        $existing = IdempotencyKeyModel::query()
            ->where('key', $key)
            ->where('user_id', $userId)
            ->first();

        if ($existing !== null) {
            if ($existing->request_hash !== $requestHash) {
                return ApiResponse::error(
                    'Idempotency-Key was already used with a different request payload.',
                    409,
                    self::CONFLICT_CODE,
                );
            }

            $body = is_array($existing->response_body) ? $existing->response_body : [];
            $status = $existing->response_status > 0 ? $existing->response_status : 200;

            return new JsonResponse($body, $status);
        }

        /** @var Response $response */
        $response = $next($request);

        // Only persist successful 2xx responses; client errors are
        // expected to be retried with the same key (and same payload),
        // which is fine because the row is keyed on (key, user_id,
        // request_hash) — but we also want to avoid storing server
        // errors as if they were successful replays.
        if ($response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
            $body = $this->decodeJsonBody($response);

            try {
                IdempotencyKeyModel::query()->create([
                    'key' => $key,
                    'user_id' => $userId,
                    'route' => $route,
                    'request_hash' => $requestHash,
                    'response_status' => $response->getStatusCode(),
                    'response_body' => $body,
                    'created_at' => now(),
                ]);
            } catch (QueryException) {
                // Concurrent insert with the same key — let the racing
                // request win; the client can retry the idempotent
                // request and will get the stored response.
            }
        }

        return $response;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJsonBody(Response $response): array
    {
        $content = $response->getContent();

        if (! is_string($content) || $content === '') {
            return [];
        }

        $decoded = json_decode($content, true);

        if (! is_array($decoded)) {
            return [];
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }
}
