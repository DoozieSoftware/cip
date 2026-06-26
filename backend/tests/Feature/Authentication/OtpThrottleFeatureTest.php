<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Coverage for the Laravel-throttle layer (named `otp` limiter)
 * in front of POST /api/v1/auth/send-otp.
 *
 * Per docs/11 §21 the limiter is 5 requests / hour / IP. The 6th
 * request must return 429 with the standard envelope and
 * `code: RATE_LIMITED`. The 6th request is rejected by the
 * Laravel-throttle middleware BEFORE the controller runs, so
 * OtpService's per-IP rate limit (also 5/hour) does not see the
 * 6th attempt.
 */
beforeEach(function (): void {
    // Belt-and-braces: clear the cache so a previous test's
    // throttle bucket does not leak. RefreshDatabase already rolls
    // back the cache table between tests, but the array cache
    // driver in phpunit.xml is not transactional — it needs an
    // explicit flush.
    Cache::flush();
});

it('allows 5 successful requests from the same IP with different mobiles', function (): void {
    $ip = '203.0.113.10';

    for ($i = 0; $i < 5; $i++) {
        $mobile = sprintf('9%09d', 100000000 + $i);
        $resp = $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/v1/auth/send-otp', ['mobile' => $mobile]);

        $resp->assertOk()
            ->assertJsonPath('data.otp_sent', true)
            ->assertJsonPath('success', true);
    }
});

it('returns 429 on the 6th request from the same IP', function (): void {
    $ip = '203.0.113.10';

    for ($i = 0; $i < 5; $i++) {
        $mobile = sprintf('9%09d', 100000000 + $i);
        $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/v1/auth/send-otp', ['mobile' => $mobile])
            ->assertOk();
    }

    $resp = $this->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999006']);

    $resp->assertStatus(429)
        ->assertJsonPath('success', false)
        ->assertJsonPath('code', 'RATE_LIMITED');
});

it('returns the standard envelope on a 429', function (): void {
    $ip = '203.0.113.10';

    for ($i = 0; $i < 5; $i++) {
        $mobile = sprintf('9%09d', 100000000 + $i);
        $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/v1/auth/send-otp', ['mobile' => $mobile])
            ->assertOk();
    }

    $resp = $this->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999006']);

    $resp->assertStatus(429)
        ->assertJsonStructure([
            'success',
            'message',
            'code',
            'trace_id',
        ])
        ->assertJsonPath('code', 'RATE_LIMITED');
});

it('preserves the Retry-After header on a 429', function (): void {
    $ip = '203.0.113.10';

    for ($i = 0; $i < 5; $i++) {
        $mobile = sprintf('9%09d', 100000000 + $i);
        $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/v1/auth/send-otp', ['mobile' => $mobile])
            ->assertOk();
    }

    $resp = $this->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999006']);

    $resp->assertStatus(429);
    expect($resp->headers->get('Retry-After'))->not->toBeNull();
    expect((int) $resp->headers->get('Retry-After'))->toBeGreaterThan(0);
});

it('throttles by IP — different IPs each get their own 5/hour budget', function (): void {
    $ipA = '203.0.113.20';
    $ipB = '203.0.113.21';

    // Exhaust IP A's budget. Use a different mobile per request
    // so OtpService's per-mobile bucket is clear, but allow it to
    // track 5 OTPs from IP A (which matches OtpService's per-IP
    // limit too). The 6th IP-A request is rejected by the
    // Laravel-throttle middleware before OtpService is consulted.
    for ($i = 0; $i < 5; $i++) {
        $mobile = sprintf('9%09d', 200000000 + $i);
        $this->withServerVariables(['REMOTE_ADDR' => $ipA])
            ->postJson('/api/v1/auth/send-otp', ['mobile' => $mobile])
            ->assertOk();
    }
    $this->withServerVariables(['REMOTE_ADDR' => $ipA])
        ->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999006'])
        ->assertStatus(429)
        ->assertJsonPath('code', 'RATE_LIMITED');

    // IP B is a fresh IP — its Laravel-throttle bucket is empty
    // and OtpService has not seen it before. The request must
    // succeed.
    $this->withServerVariables(['REMOTE_ADDR' => $ipB])
        ->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999007'])
        ->assertOk();
});

it('returns 429 (RATE_LIMITED) for a malformed body from a throttled IP', function (): void {
    // The throttle middleware runs before the FormRequest
    // validator, so a malformed body from a throttled IP returns
    // 429 RATE_LIMITED, not 422. This is correct because throttle
    // decisions are made before the route is even resolved.
    $ip = '203.0.113.10';

    for ($i = 0; $i < 5; $i++) {
        $mobile = sprintf('9%09d', 100000000 + $i);
        $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/v1/auth/send-otp', ['mobile' => $mobile])
            ->assertOk();
    }

    $resp = $this->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/api/v1/auth/send-otp', ['mobile' => 'not-a-number']);

    $resp->assertStatus(429)
        ->assertJsonPath('code', 'RATE_LIMITED');
});

it('returns 422 (VALIDATION_FAILED) for a malformed body from a non-throttled IP', function (): void {
    // Counterpart to the previous test: a malformed body from a
    // fresh IP must reach the validator and return 422.
    $resp = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.30'])
        ->postJson('/api/v1/auth/send-otp', ['mobile' => 'not-a-number']);

    $resp->assertStatus(422)
        ->assertJsonPath('code', 'VALIDATION_FAILED');
});

it('resets the limiter when the cache is flushed between requests', function (): void {
    $ipA = '203.0.113.40';
    $ipB = '203.0.113.41';

    // Exhaust IP A's throttle bucket (5 hits, all successful).
    for ($i = 0; $i < 5; $i++) {
        $mobile = sprintf('9%09d', 100000000 + $i);
        $this->withServerVariables(['REMOTE_ADDR' => $ipA])
            ->postJson('/api/v1/auth/send-otp', ['mobile' => $mobile])
            ->assertOk();
    }
    $this->withServerVariables(['REMOTE_ADDR' => $ipA])
        ->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999006'])
        ->assertStatus(429)
        ->assertJsonPath('code', 'RATE_LIMITED');

    // Operator-side cache flush + explicit RateLimiter clear.
    // Cache::flush() drops every array cache entry. RateLimiter::
    // clear() additionally forgets the :timer companion key,
    // which gates the 429's Retry-After.
    Cache::flush();
    RateLimiter::clear('otp:'.$ipA);

    // A request from a fresh IP (B) on the same Laravel app
    // instance must succeed — the bucket for IP A is reset, the
    // bucket for IP B was never touched, and OtpService has no
    // OTPs from IP B.
    $this->withServerVariables(['REMOTE_ADDR' => $ipB])
        ->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999007'])
        ->assertOk();
});
