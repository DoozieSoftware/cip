<?php

declare(strict_types=1);

namespace App\Modules\Security\Services;

use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Services\BaseService;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Single entry point for security-event capture.
 *
 * Per docs/11 §29. Auth endpoints, the audit middleware, and the
 * future risk engine all funnel their events through this service
 * so that:
 *  - the `event` name is a short stable constant
 *  - the `severity` is constrained to the allow-list
 *  - the metadata payload is JSON-encoded + null-coerced so the
 *    model never carries a non-array cast result
 *  - the write is fail-open: a failed event recording must not
 *    break the calling flow (the failure is logged + surfaced
 *    through the standard Log channel)
 *
 * Append-only invariant: the underlying SecurityEvent model
 * rejects update + delete at the Eloquent layer. The service
 * never tries to mutate a row.
 */
class SecurityEventService extends BaseService
{
    public const SEVERITY_INFO = SecurityEvent::SEVERITY_INFO;

    public const SEVERITY_WARNING = SecurityEvent::SEVERITY_WARNING;

    public const SEVERITY_CRITICAL = SecurityEvent::SEVERITY_CRITICAL;

    /**
     * Record a security event.
     *
     * @param  string  $event  short constant, e.g. `login.failed`, `token.reuse_detected`
     * @param  string  $severity  one of `info`, `warning`, `critical`
     * @param  array<string, mixed>|null  $metadata  free-form payload (no PII)
     * @param  User|null  $user  actor — may be null for pre-auth events
     * @param  string|null  $ip  source IP — falls back to the request IP if null
     * @param  string|null  $userAgent  UA — falls back to the request UA if null
     *
     * @throws ApiException 422 when the severity is not in the allow-list
     */
    public function record(
        string $event,
        string $severity = self::SEVERITY_INFO,
        ?array $metadata = null,
        ?User $user = null,
        ?string $ip = null,
        ?string $userAgent = null,
    ): SecurityEvent {
        $severity = $this->normalizeSeverity($severity);
        $event = $this->normalizeEvent($event);
        $metadata = $this->normalizeMetadata($metadata);

        $resolvedIp = $ip ?? $this->requestIp();
        $resolvedUa = $userAgent ?? $this->requestUserAgent();

        $row = new SecurityEvent;
        $key = $user?->getKey();
        $row->user_id = is_string($key) || is_int($key) ? (string) $key : null;
        $row->event = $event;
        $row->severity = $severity;
        $row->metadata = $metadata;
        $row->ip = $resolvedIp;
        $row->user_agent = $resolvedUa;
        $row->created_at = now();
        $row->save();

        return $row;
    }

    /**
     * Convenience wrapper for "info" events.
     *
     * @param  array<string, mixed>|null  $metadata
     */
    public function info(string $event, ?array $metadata = null, ?User $user = null): SecurityEvent
    {
        return $this->record($event, self::SEVERITY_INFO, $metadata, $user);
    }

    /**
     * Convenience wrapper for "warning" events.
     *
     * @param  array<string, mixed>|null  $metadata
     */
    public function warning(string $event, ?array $metadata = null, ?User $user = null): SecurityEvent
    {
        return $this->record($event, self::SEVERITY_WARNING, $metadata, $user);
    }

    /**
     * Convenience wrapper for "critical" events.
     *
     * @param  array<string, mixed>|null  $metadata
     */
    public function critical(string $event, ?array $metadata = null, ?User $user = null): SecurityEvent
    {
        return $this->record($event, self::SEVERITY_CRITICAL, $metadata, $user);
    }

    /**
     * Fail-open recorder for hot paths. Never throws — the original
     * exception is logged through the standard Log channel.
     *
     * @param  array<string, mixed>|null  $metadata
     */
    public function recordSafe(
        string $event,
        string $severity = self::SEVERITY_INFO,
        ?array $metadata = null,
        ?User $user = null,
    ): ?SecurityEvent {
        try {
            return $this->record($event, $severity, $metadata, $user);
        } catch (Throwable $e) {
            Log::warning('security_event.write_failed', [
                'event' => $event,
                'severity' => $severity,
                'user_id' => $user?->getKey(),
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function normalizeSeverity(string $severity): string
    {
        $severity = strtolower(trim($severity));

        if (! in_array($severity, SecurityEvent::ALLOWED_SEVERITIES, true)) {
            throw new ApiException(
                'INVALID_SEVERITY',
                "Security event severity '{$severity}' is not in the allow-list.",
                422,
            );
        }

        return $severity;
    }

    private function normalizeEvent(string $event): string
    {
        $event = trim($event);

        if ($event === '') {
            throw new ApiException(
                'INVALID_EVENT',
                'Security event name cannot be empty.',
                422,
            );
        }

        if (strlen($event) > 64) {
            throw new ApiException(
                'INVALID_EVENT',
                'Security event name is longer than 64 characters.',
                422,
            );
        }

        return $event;
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     * @return array<string, mixed>|null
     */
    private function normalizeMetadata(?array $metadata): ?array
    {
        if ($metadata === null || $metadata === []) {
            return null;
        }

        return $metadata;
    }

    private function requestIp(): ?string
    {
        try {
            $request = request();

            if ($request === null) {
                return null;
            }
            $ip = $request->ip();

            return $ip !== null && $ip !== '' ? $ip : null;
        } catch (Throwable) {
            return null;
        }
    }

    private function requestUserAgent(): ?string
    {
        try {
            $request = request();

            if ($request === null) {
                return null;
            }
            $ua = $request->userAgent();

            if ($ua === null) {
                return null;
            }
            $ua = (string) $ua;

            return $ua !== '' ? mb_substr($ua, 0, 512) : null;
        } catch (Throwable) {
            return null;
        }
    }
}
