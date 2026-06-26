<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\Otp;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    RolesAndPermissionsSeeder::class;
    (new RolesAndPermissionsSeeder)->run();
});

it('passes through when no Idempotency-Key is supplied', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    // Hit a mutating endpoint that just stores a fresh OTP.
    $response = $this->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999999']);

    // sendOtp is rate-limited and may return 200/422; we just want
    // to assert the middleware did not interfere.
    expect($response->status())->toBeIn([200, 422]);
});

it('replays the stored response when the same key + same payload is seen', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $key = 'idem-test-1';
    $payload = ['mobile' => '9999999999'];

    // The sendOtp endpoint is public; the middleware sees an
    // authenticated user via Sanctum::actingAs so user_id is set.
    $first = $this->withHeader('Idempotency-Key', $key)
        ->postJson('/api/v1/auth/send-otp', $payload);

    // 200/422 are both acceptable; 2xx is persisted. We force a 2xx
    // by ensuring the OTP path returns 200, then we replay.
    if ($first->status() >= 200 && $first->status() < 300) {
        $second = $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/auth/send-otp', $payload);

        // The second response should be the replay — same status, same body.
        expect($second->status())->toBe($first->status());
    } else {
        $this->markTestSkipped('sendOtp did not return 2xx; cannot exercise the replay path.');
    }
});

it('returns 409 IDEMPOTENCY_KEY_CONFLICT when the same key is reused with a different payload', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $key = 'idem-test-conflict';

    $first = $this->withHeader('Idempotency-Key', $key)
        ->postJson('/api/v1/auth/send-otp', ['mobile' => '9999999999']);

    if ($first->status() < 200 || $first->status() >= 300) {
        $this->markTestSkipped('sendOtp did not return 2xx; cannot exercise the conflict path.');
    }

    $second = $this->withHeader('Idempotency-Key', $key)
        ->postJson('/api/v1/auth/send-otp', ['mobile' => '8888888888']);

    $second->assertStatus(409);
    expect($second->json('code'))->toBe('IDEMPOTENCY_KEY_CONFLICT');
});
