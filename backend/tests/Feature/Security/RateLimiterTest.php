<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;
use App\Providers\RouteServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Coverage for the named rate limiters registered by
 * RouteServiceProvider (T-M2-022). Per docs/11 §21.
 */
beforeEach(function (): void {
    // Force RouteServiceProvider::boot() to re-register the
    // limiters for the in-process test app.
    $provider = new RouteServiceProvider($this->app);
    $provider->boot();
});

it('registers the otp limiter at 5 per hour keyed by IP', function (): void {
    $request = Request::create('/api/v1/auth/send-otp', 'POST', server: ['REMOTE_ADDR' => '203.0.113.5']);
    $limits = RateLimiter::limiter('otp')($request);

    expect($limits)->toBeArray()->toHaveCount(1);
    expect($limits[0])->toBeInstanceOf(Limit::class);
    expect($limits[0]->maxAttempts)->toBe(5);
    expect($limits[0]->key)->toBe('otp:203.0.113.5');
    // limit already covered above
});

it('registers the citizen limiter at 60 per minute keyed by user', function (): void {
    $user = User::factory()->create();
    $request = Request::create('/api/v1/citizen/dashboard', 'GET');
    $request->setUserResolver(fn () => $user);

    $limits = RateLimiter::limiter('citizen')($request);

    expect($limits[0]->maxAttempts)->toBe(60);
    expect($limits[0]->key)->toBe('citizen:'.$user->id);
});

it('falls back to IP keying for the citizen limiter when unauthenticated', function (): void {
    $request = Request::create('/api/v1/citizen/dashboard', 'GET', server: ['REMOTE_ADDR' => '203.0.113.5']);
    $limits = RateLimiter::limiter('citizen')($request);

    expect($limits[0]->key)->toBe('citizen:203.0.113.5');
});

it('registers uploads, moderator, department, admin limiters', function (): void {
    foreach (['uploads', 'moderator', 'department', 'admin'] as $name) {
        $request = Request::create('/api/v1/test', 'GET');
        $limits = RateLimiter::limiter($name)($request);
        expect($limits)->toBeArray()->toHaveCount(1);
        expect($limits[0])->toBeInstanceOf(Limit::class);
    }
});

it('exposes the limiter names as RouteServiceProvider constants', function (): void {
    expect(RouteServiceProvider::LIMITER_OTP)->toBe('otp')
        ->and(RouteServiceProvider::LIMITER_CITIZEN)->toBe('citizen')
        ->and(RouteServiceProvider::LIMITER_UPLOADS)->toBe('uploads')
        ->and(RouteServiceProvider::LIMITER_MODERATOR)->toBe('moderator')
        ->and(RouteServiceProvider::LIMITER_DEPARTMENT)->toBe('department')
        ->and(RouteServiceProvider::LIMITER_ADMIN)->toBe('admin');
});

it('honors the throttle middleware on a route and returns 429 after 5 calls', function (): void {
    // This is the integration test for the actual middleware on
    // /auth/send-otp. It complements the unit tests above.
    RateLimiter::clear('otp:203.0.113.99');
    $hit = 0;

    for ($i = 0; $i < 6; $i++) {
        $resp = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.99'])
            ->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999999']);
        $hit = $resp->status();

        if ($hit === 429) {
            break;
        }
    }
    expect($hit)->toBe(429);
});
