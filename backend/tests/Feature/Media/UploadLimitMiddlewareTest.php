<?php

declare(strict_types=1);

use App\Modules\Media\Http\Middleware\MediaUploadLimit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Users\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);


beforeEach(function (): void {
    Cache::flush();
});

/**
 * Build a Laravel Request that exposes the given Content-Length
 * to the middleware via both the Symfony server bag and the
 * headers bag (Pest's postJson does not propagate $_SERVER).
 */
function makeUploadRequest(User $user, int $contentLength): Request
{
    $request = Request::create('/upload', 'POST', [], [], [], [
        'CONTENT_LENGTH' => (string) $contentLength,
    ]);
    $request->headers->set('Content-Length', (string) $contentLength);
    $request->headers->set('Accept', 'application/json');
    Sanctum::actingAs($user, ['citizen'], 'web');
    $request->setUserResolver(fn () => $user);

    return $request;
}

it('returns 413 when the single request Content-Length exceeds 100 MB', function (): void {
    $user = User::factory()->create();
    $middleware = new MediaUploadLimit;

    $response = $middleware->handle(
        makeUploadRequest($user, 100 * 1024 * 1024 + 1),
        fn (Request $r) => response()->json(['ok' => true]),
    );

    expect($response->getStatusCode())->toBe(413);
    $payload = json_decode($response->getContent(), true);
    expect($payload['code'])->toBe('VALIDATION_FAILED');
});

it('returns 413 when the per-user hourly aggregate exceeds 100 MB (acceptance)', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user, ['citizen']);

    // Pre-seed the per-user counter at 100 MB for the current hour.
    $key = 'media_upload:'.$user->id.':'.now()->format('YmdH');
    Cache::add($key, 100 * 1024 * 1024, now()->endOfHour());

    $middleware = new MediaUploadLimit;
    $response = $middleware->handle(
        makeUploadRequest($user, 1),
        fn (Request $r) => response()->json(['ok' => true]),
    );

    expect($response->getStatusCode())->toBe(413);
    $payload = json_decode($response->getContent(), true);
    expect($payload['code'])->toBe('RATE_LIMITED');
});

it('allows a request within both limits and returns the X-Cip-Upload-Total header', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user, ['citizen']);

    $middleware = new MediaUploadLimit;
    $response = $middleware->handle(
        makeUploadRequest($user, 1024),
        fn (Request $r) => response()->json(['ok' => true]),
    );

    expect($response->getStatusCode())->toBe(200)
        ->and($response->headers->get('X-Cip-Upload-Total'))->toBe('1024');
});

it('the counter is keyed on the current hour so it naturally rolls over (acceptance: counter resets hourly)', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user, ['citizen']);

    // Seed the previous-hour bucket to 100 MB; current-hour is empty.
    $prev = 'media_upload:'.$user->id.':'.now()->subHour()->format('YmdH');
    Cache::add($prev, 100 * 1024 * 1024, now()->subHour()->endOfHour());

    $middleware = new MediaUploadLimit;
    $response = $middleware->handle(
        makeUploadRequest($user, 2048),
        fn (Request $r) => response()->json(['ok' => true]),
    );

    // The previous-hour 100 MB does not block the current-hour 2 KB.
    expect($response->getStatusCode())->toBe(200);
});

it('unauthenticated requests are not per-user rate-limited (auth runs separately)', function (): void {
    $request = Request::create('/upload', 'POST', [], [], [], [
        'CONTENT_LENGTH' => '1024',
    ]);
    $request->headers->set('Content-Length', '1024');

    $middleware = new MediaUploadLimit;
    $response = $middleware->handle(
        $request,
        fn (Request $r) => response()->json(['ok' => true]),
    );

    expect($response->getStatusCode())->toBe(200);
});
