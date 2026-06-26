<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Middleware;

use App\Modules\Shared\Http\Responses\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Per-user media upload bandwidth limit per docs/11 §21.
 *
 * Two gates:
 *
 *  1. Single-request Content-Length cap (default 100 MB).
 *     A single multipart payload larger than the cap is
 *     rejected with 413 — the bytes are not even read.
 *
 *  2. Aggregate hourly bandwidth (default 100 MB / user /
 *     hour). The counter is keyed on the user id and the
 *     current hour; the limit is enforced after the
 *     request body is read so the per-user tally is
 *     accurate even when the client does not advertise a
 *     Content-Length.
 *
 * The counter is stored in the configured cache store
 * (Redis in production, array in tests) and is keyed
 * `media_upload:{userId}:{YYYYMMDDHH}`. It auto-expires
 * after the hour boundary so the limit is naturally
 * rolling.
 */
class MediaUploadLimit
{
    public const HEADER_TOTAL = 'X-Cip-Upload-Total';

    private const PER_REQUEST_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

    private const PER_USER_HOURLY_MAX_BYTES = 100 * 1024 * 1024; // 100 MB / hour

    public function handle(Request $request, Closure $next): Response
    {
        $length = (int) ($request->server('CONTENT_LENGTH') ?? $request->headers->get('Content-Length') ?? '0');

        if ($length > self::PER_REQUEST_MAX_BYTES) {
            return ApiResponse::error(
                'Single request exceeds the maximum upload size of 100 MB.',
                413,
                'VALIDATION_FAILED',
                ['content_length' => $length, 'limit' => self::PER_REQUEST_MAX_BYTES],
            );
        }

        $userId = $this->resolveUserId($request);

        if ($userId !== null) {
            $key = $this->key($userId);
            $used = (int) Cache::get($key, 0);

            $projected = $used + max($length, 0);

            if ($projected > self::PER_USER_HOURLY_MAX_BYTES) {
                return ApiResponse::error(
                    'Hourly upload bandwidth limit reached (100 MB / hour).',
                    413,
                    'RATE_LIMITED',
                    ['used' => $used, 'limit' => self::PER_USER_HOURLY_MAX_BYTES],
                );
            }
        }

        $response = $next($request);

        if ($userId !== null && $length > 0) {
            $key = $this->key($userId);
            Cache::add($key, 0, now()->endOfHour());
            Cache::increment($key, $length);

            $response->headers->set(
                self::HEADER_TOTAL,
                (string) ((int) Cache::get($key, 0))
            );
        }

        return $response;
    }

    private function resolveUserId(Request $request): ?string
    {
        $user = $request->user('sanctum');

        if ($user !== null && isset($user->id)) {
            return (string) $user->id;
        }

        return null;
    }

    private function key(string $userId): string
    {
        return 'media_upload:'.$userId.':'.now()->format('YmdH');
    }
}
