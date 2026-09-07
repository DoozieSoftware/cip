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
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
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
            /** @var Response $response */
            $response = $next($request);

            return $response;
        }

        $key = $request->header(self::HEADER);

        if (! is_string($key) || $key === '') {
            // No key supplied — pass through. The route contract decides
            // whether keys are required.
            /** @var Response $response */
            $response = $next($request);

            return $response;
        }

        $user = $request->user();
        $userId = $user instanceof User ? (string) $user->id : null;
        // This middleware is global and can run before Laravel attaches the
        // route name to the request. Falling back to the concrete request
        // path keeps separate endpoints (for example report creation and
        // report finalization) from sharing one idempotency scope.
        $routeName = $request->route()?->getName();
        $route = is_string($routeName) && $routeName !== ''
            ? $routeName
            : '/'.ltrim($request->path(), '/');
        $method = $request->getMethod();
        $requestHash = $this->computeRequestHash($request);

        // Reserve the key before invoking the handler. A unique constraint
        // arbitrates the race; a zero response status means another request
        // owns the reservation and prevents duplicate side effects.
        $claimed = false;

        try {
            $existing = DB::transaction(function () use ($key, $userId, $route, $method, $requestHash, &$claimed): IdempotencyKeyModel {
                $query = IdempotencyKeyModel::query()
                    ->where('key', $key)
                    ->where('user_id', $userId)
                    ->where('route', $route)
                    ->where('method', $method)
                    ->lockForUpdate();
                $existing = $query->first();

                if ($existing !== null) {
                    if ($existing->response_status === 0
                        && $existing->pending_expires_at !== null
                        && $existing->pending_expires_at->isPast()) {
                        // Recover a reservation left behind by a crashed
                        // worker without allowing two live handlers.
                        $existing->pending_expires_at = now()->addMinutes(5);
                        $existing->save();
                        $claimed = true;
                    }

                    return $existing;
                }

                $claimed = true;

                return IdempotencyKeyModel::query()->create([
                    'key' => $key,
                    'user_id' => $userId,
                    'route' => $route,
                    'method' => $method,
                    'request_hash' => $requestHash,
                    'response_status' => 0,
                    'response_body' => null,
                    'pending_expires_at' => now()->addMinutes(5),
                    'created_at' => now(),
                ]);

            });
        } catch (QueryException) {
            // A concurrent request won the unique insert. Read its row after
            // the failed transaction has released the lock.
            $existing = IdempotencyKeyModel::query()
                ->where('key', $key)
                ->where('user_id', $userId)
                ->where('route', $route)
                ->where('method', $method)
                ->first();
        }

        if ($existing === null) {
            return ApiResponse::error(
                'The request could not reserve its Idempotency-Key. Please retry.',
                409,
                'IDEMPOTENCY_KEY_UNAVAILABLE',
            );
        }

        if (! $claimed) {
            if ($existing->request_hash !== $requestHash) {
                return ApiResponse::error(
                    'Idempotency-Key was already used with a different request payload.',
                    409,
                    self::CONFLICT_CODE,
                );
            }

            if ($existing->response_status === 0) {
                return ApiResponse::error(
                    'A request with this Idempotency-Key is already in progress.',
                    409,
                    'IDEMPOTENCY_KEY_IN_PROGRESS',
                );
            }

            $body = is_array($existing->response_body) ? $existing->response_body : [];
            $status = $existing->response_status;

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

            IdempotencyKeyModel::query()
                ->whereKey($existing->id)
                ->where('response_status', 0)
                ->update([
                    'response_status' => $response->getStatusCode(),
                    'response_body' => $body,
                    'pending_expires_at' => null,
                ]);
        } elseif ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
            // Validation/server failures must release the reservation so a
            // retry can execute the handler with the same key.
            IdempotencyKeyModel::query()
                ->whereKey($existing->id)
                ->where('response_status', 0)
                ->delete();
        }

        return $response;
    }

    private function computeRequestHash(Request $request): string
    {
        // Phase 4 offline-safe: multipart boundaries are random per
        // request, so hashing raw getContent() would make two identical
        // proof-photo uploads appear different. For multipart, hash a
        // stable digest of inputs + file hashes instead.
        if ($request->hasFile('photo') || $request->hasFile('file')) {
            $parts = [];
            $input = $request->except(['photo', 'file']);
            ksort($input);
            $parts[] = json_encode($input, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            foreach (['photo', 'file'] as $key) {
                $file = $request->file($key);

                if ($file === null) {
                    continue;
                }
                $files = is_array($file) ? $file : [$file];

                foreach ($files as $f) {
                    if ($f instanceof UploadedFile) {
                        $hash = @hash_file('sha256', (string) $f->getRealPath());
                        $parts[] = $key.':'.($hash ?: $f->getClientOriginalName().':'.$f->getSize());
                    }
                }
            }

            return hash('sha256', implode('|', $parts));
        }

        return hash('sha256', (string) $request->getContent());
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
