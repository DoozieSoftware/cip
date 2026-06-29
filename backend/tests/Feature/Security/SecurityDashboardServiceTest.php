<?php

declare(strict_types=1);

use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Security\Services\SecurityDashboardService;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('returns zero counts when the system is quiet', function (): void {
    /** @var SecurityDashboardService $service */
    $service = app(SecurityDashboardService::class);

    $snap = $service->snapshot();
    expect($snap['failed_logins']['count'])->toBe(0)
        ->and($snap['locked_accounts']['count'])->toBe(0)
        ->and($snap['mock_gps_reports']['count'])->toBe(0)
        ->and($snap['spam_detection']['count'])->toBe(0)
        ->and($snap['rate_limited_users']['count'])->toBe(0)
        ->and($snap['suspicious_devices']['count'])->toBe(0)
        ->and($snap['blocked_users']['count'])->toBe(0)
        ->and($snap['security_alerts']['count'])->toBe(0)
        ->and($snap['generated_at'])->not->toBeNull();
});

it('exposes the most recent rows for the suspicious_devices widget', function (): void {
    /** @var SecurityDashboardService $service */
    $service = app(SecurityDashboardService::class);

    $user = User::factory()->create();
    SecurityEvent::query()->create([
        'user_id' => $user->id,
        'event' => 'device.mismatch',
        'severity' => SecurityEvent::SEVERITY_WARNING,
        'ip' => '127.0.0.1',
    ]);
    SecurityEvent::query()->create([
        'user_id' => $user->id,
        'event' => 'token.reuse_detected',
        'severity' => SecurityEvent::SEVERITY_CRITICAL,
    ]);

    $snap = $service->snapshot();
    expect($snap['suspicious_devices']['count'])->toBe(2);
    expect($snap['suspicious_devices']['recent'][0]['event'])->toBe('token.reuse_detected');
    expect($snap['suspicious_devices']['recent'][0]['severity'])->toBe('critical');
});

it('counts spam and rate-limit events by prefix', function (): void {
    /** @var SecurityDashboardService $service */
    $service = app(SecurityDashboardService::class);

    SecurityEvent::query()->create([
        'event' => 'spam.detected',
        'severity' => SecurityEvent::SEVERITY_WARNING,
    ]);
    SecurityEvent::query()->create([
        'event' => 'rate_limit.trip',
        'severity' => SecurityEvent::SEVERITY_WARNING,
    ]);
    SecurityEvent::query()->create([
        'event' => 'login.succeeded',
        'severity' => SecurityEvent::SEVERITY_INFO,
    ]);

    $snap = $service->snapshot();
    expect($snap['spam_detection']['count'])->toBe(1)
        ->and($snap['rate_limited_users']['count'])->toBe(1);
});

it('ignores older-than-24h events for the failed logins widget', function (): void {
    DB::table('login_histories')->insert([
        'id' => '00000000-0000-0000-0000-00000000b001',
        'user_id' => null,
        'mobile' => '9000000000',
        'success' => false,
        'failure_reason' => 'invalid_code',
        'login_at' => now()->subDays(2),
    ]);
    DB::table('login_histories')->insert([
        'id' => '00000000-0000-0000-0000-00000000b002',
        'user_id' => null,
        'mobile' => '9111111111',
        'success' => false,
        'failure_reason' => 'expired',
        'login_at' => now()->subMinutes(5),
    ]);

    /** @var SecurityDashboardService $service */
    $service = app(SecurityDashboardService::class);
    $snap = $service->snapshot();
    expect($snap['failed_logins']['count'])->toBe(1)
        ->and($snap['failed_logins']['recent'][0]['mobile'])->toBe('9111111111');
});
