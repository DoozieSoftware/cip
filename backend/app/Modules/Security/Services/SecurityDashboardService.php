<?php

declare(strict_types=1);

namespace App\Modules\Security\Services;

use App\Modules\Security\Models\AuditLog;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Users\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * T-M11-020 — Security dashboard aggregator.
 *
 * Per `docs/08` §19 the security dashboard surfaces a set of read-only
 * widgets. The widgets are backed by data we already write in M2 (auth +
 * security) and M8 (AI fraud scoring):
 *
 *  - Failed logins       : `login_histories` where `success = false` (24h)
 *  - Locked accounts     : `users` where `status = 'suspended'`
 *  - Mock GPS reports    : `security_events` with `event = 'mock_gps'`
 *  - Spam detection      : `security_events` with `event LIKE 'spam.%'`
 *  - Rate-limited users  : `security_events` with `event = 'rate_limit.trip'`
 *  - Suspicious devices  : `security_events` with `event LIKE 'device.%'`
 *                          or `severity = 'critical'`
 *  - Blocked users       : `users` where `status = 'banned'`
 *  - Security alerts     : `security_events` with `severity = 'critical'`
 *                          in the last 24h
 *
 * The dashboard is a single JSON object; each widget returns a small
 * count plus a representative slice of recent events (max 5) so the
 * UI can show "what's new" without a follow-up fetch.
 */
class SecurityDashboardService
{
    private const RECENT_LIMIT = 5;

    private const WINDOW_24H_HOURS = 24;

    /**
     * @return array<string, array<string, mixed>>
     */
    public function snapshot(): array
    {
        $now = Carbon::now();
        $since24h = $now->copy()->subHours(self::WINDOW_24H_HOURS);

        return [
            'failed_logins' => $this->failedLogins($since24h),
            'locked_accounts' => $this->lockedAccounts(),
            'mock_gps_reports' => $this->securityEventsByEventName('mock_gps', $since24h),
            'spam_detection' => $this->securityEventsByEventPattern('spam.%', $since24h),
            'rate_limited_users' => $this->securityEventsByEventName('rate_limit.trip', $since24h),
            'suspicious_devices' => $this->suspiciousDevices($since24h),
            'blocked_users' => $this->blockedUsers(),
            'security_alerts' => $this->criticalAlerts($since24h),
            'generated_at' => $now->toIso8601String(),
        ];
    }

    /**
     * @return array{count: int, recent: array<int, array<string, mixed>>}
     */
    private function failedLogins(Carbon $since): array
    {
        $count = (int) DB::table('login_histories')
            ->where('success', false)
            ->where('login_at', '>=', $since)
            ->count();

        $recent = DB::table('login_histories as lh')
            ->leftJoin('users as u', 'u.id', '=', 'lh.user_id')
            ->select(
                'lh.id',
                'lh.user_id',
                'u.name as user_name',
                'lh.mobile',
                'lh.ip',
                'lh.failure_reason',
                'lh.login_at',
            )
            ->where('lh.success', false)
            ->where('lh.login_at', '>=', $since)
            ->orderByDesc('lh.login_at')
            ->limit(self::RECENT_LIMIT)
            ->get()
            ->map(static function (object $row): array {
                return [
                    'id' => $row->id,
                    'user_id' => $row->user_id,
                    'user_name' => $row->user_name,
                    'mobile' => $row->mobile,
                    'ip' => $row->ip,
                    'failure_reason' => $row->failure_reason,
                    'login_at' => $row->login_at,
                ];
            })
            ->all();

        return ['count' => $count, 'recent' => $recent];
    }

    /**
     * @return array{count: int, recent: array<int, array<string, mixed>>}
     */
    private function lockedAccounts(): array
    {
        $rows = User::query()
            ->where('status', 'suspended')
            ->orderByDesc('updated_at')
            ->limit(self::RECENT_LIMIT)
            ->get(['id', 'name', 'mobile', 'email', 'status', 'updated_at']);

        $count = (int) User::query()->where('status', 'suspended')->count();

        return [
            'count' => $count,
            'recent' => $rows->map(static fn (User $u): array => [
                'id' => $u->id,
                'name' => $u->name,
                'mobile' => $u->mobile,
                'email' => $u->email,
                'status' => $u->status,
                'updated_at' => $u->updated_at?->toIso8601String(),
            ])->all(),
        ];
    }

    /**
     * @return array{count: int, recent: array<int, array<string, mixed>>}
     */
    private function securityEventsByEventName(string $event, Carbon $since): array
    {
        return $this->securityEventsByEventPattern($event, $since);
    }

    /**
     * @return array{count: int, recent: array<int, array<string, mixed>>}
     */
    private function securityEventsByEventPattern(string $pattern, Carbon $since): array
    {
        $count = SecurityEvent::query()
            ->where('event', 'like', $pattern)
            ->where('created_at', '>=', $since)
            ->count();

        $rows = SecurityEvent::query()
            ->where('event', 'like', $pattern)
            ->where('created_at', '>=', $since)
            ->orderByDesc('created_at')
            ->limit(self::RECENT_LIMIT)
            ->get();

        return [
            'count' => $count,
            'recent' => $rows->map(static fn (SecurityEvent $e): array => [
                'id' => $e->id,
                'event' => $e->event,
                'severity' => $e->severity,
                'user_id' => $e->user_id,
                'ip' => $e->ip,
                'created_at' => $e->created_at?->toIso8601String(),
            ])->all(),
        ];
    }

    /**
     * Suspicious devices combines the device.* event family
     * with any critical-severity event in the window — both
     * are what an operator would expect to see together.
     *
     * @return array{count: int, recent: array<int, array<string, mixed>>}
     */
    private function suspiciousDevices(Carbon $since): array
    {
        $rows = SecurityEvent::query()
            ->where(function ($q): void {
                $q->where('event', 'like', 'device.%')
                    ->orWhere('event', 'like', 'token.%')
                    ->orWhere('severity', SecurityEvent::SEVERITY_CRITICAL);
            })
            ->where('created_at', '>=', $since)
            ->orderByDesc('created_at')
            ->limit(self::RECENT_LIMIT)
            ->get();

        $count = SecurityEvent::query()
            ->where(function ($q): void {
                $q->where('event', 'like', 'device.%')
                    ->orWhere('event', 'like', 'token.%')
                    ->orWhere('severity', SecurityEvent::SEVERITY_CRITICAL);
            })
            ->where('created_at', '>=', $since)
            ->count();

        return [
            'count' => $count,
            'recent' => $rows->map(static fn (SecurityEvent $e): array => [
                'id' => $e->id,
                'event' => $e->event,
                'severity' => $e->severity,
                'user_id' => $e->user_id,
                'ip' => $e->ip,
                'user_agent' => $e->user_agent,
                'created_at' => $e->created_at?->toIso8601String(),
            ])->all(),
        ];
    }

    /**
     * @return array{count: int, recent: array<int, array<string, mixed>>}
     */
    private function blockedUsers(): array
    {
        $count = (int) User::query()->where('status', 'banned')->count();

        $rows = User::query()
            ->where('status', 'banned')
            ->orderByDesc('updated_at')
            ->limit(self::RECENT_LIMIT)
            ->get(['id', 'name', 'mobile', 'email', 'status', 'updated_at']);

        return [
            'count' => $count,
            'recent' => $rows->map(static fn (User $u): array => [
                'id' => $u->id,
                'name' => $u->name,
                'mobile' => $u->mobile,
                'email' => $u->email,
                'status' => $u->status,
                'updated_at' => $u->updated_at?->toIso8601String(),
            ])->all(),
        ];
    }

    /**
     * @return array{count: int, recent: array<int, array<string, mixed>>}
     */
    private function criticalAlerts(Carbon $since): array
    {
        $rows = SecurityEvent::query()
            ->where('severity', SecurityEvent::SEVERITY_CRITICAL)
            ->where('created_at', '>=', $since)
            ->orderByDesc('created_at')
            ->limit(self::RECENT_LIMIT)
            ->get();

        $count = SecurityEvent::query()
            ->where('severity', SecurityEvent::SEVERITY_CRITICAL)
            ->where('created_at', '>=', $since)
            ->count();

        return [
            'count' => $count,
            'recent' => $rows->map(static fn (SecurityEvent $e): array => [
                'id' => $e->id,
                'event' => $e->event,
                'severity' => $e->severity,
                'user_id' => $e->user_id,
                'ip' => $e->ip,
                'metadata' => $e->metadata,
                'created_at' => $e->created_at?->toIso8601String(),
            ])->all(),
        ];
    }
}
