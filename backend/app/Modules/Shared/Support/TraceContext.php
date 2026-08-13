<?php

declare(strict_types=1);

namespace App\Modules\Shared\Support;

use App\Modules\Shared\Http\Middleware\RequestId;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Carries the request correlation id into queued work and connectors.
 *
 * The id is deliberately kept in the queue payload (rather than in a job's
 * serialized properties) so existing jobs and encrypted jobs get the same
 * propagation behaviour without requiring every job class to change.
 */
final class TraceContext
{
    public const PAYLOAD_KEY = 'trace_id';

    /**
     * Return the active request/worker correlation id, if one exists.
     */
    public static function id(): ?string
    {
        if (app()->bound('request')) {
            $request = app('request');

            if ($request instanceof Request) {
                $value = $request->attributes->get(RequestId::ATTRIBUTE)
                    ?? $request->header(RequestId::HEADER);

                if (is_string($value) && $value !== '') {
                    return $value;
                }
            }
        }

        if (! self::loggingAvailable()) {
            return null;
        }

        $value = Log::sharedContext()[self::PAYLOAD_KEY] ?? null;

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * Payload hook used by Laravel's queue manager.
     *
     * A CLI-dispatched job still receives a fresh id, ensuring retries and
     * downstream connector calls can be correlated even without HTTP.
     *
     * @return array{trace_id: string}
     */
    public static function payload(): array
    {
        return [self::PAYLOAD_KEY => self::id() ?? (string) Str::uuid()];
    }

    public static function applyToJob(Job $job): void
    {
        $payload = $job->payload();
        $value = $payload[self::PAYLOAD_KEY] ?? null;

        if (is_string($value) && $value !== '') {
            if (! self::loggingAvailable()) {
                return;
            }

            Log::withContext([self::PAYLOAD_KEY => $value]);
        }
    }

    public static function clear(): void
    {
        if (! self::loggingAvailable()) {
            return;
        }

        Log::withoutContext([self::PAYLOAD_KEY]);
    }

    /**
     * Headers for outbound connector calls. No header is emitted when code is
     * invoked outside a request and before a queue job has been started.
     *
     * @return array{X-Request-Id: string}|array{}
     */
    public static function headers(): array
    {
        $value = self::id();

        return $value === null ? [] : [RequestId::HEADER => $value];
    }

    private static function loggingAvailable(): bool
    {
        return Log::getFacadeRoot() !== null;
    }
}
