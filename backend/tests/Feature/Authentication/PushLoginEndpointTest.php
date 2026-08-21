<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\PushLoginChallenge;
use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Notifications\Services\WebPushDeliveryService;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $push = Mockery::mock(WebPushDeliveryService::class);
    $push->shouldReceive('send')->zeroOrMoreTimes()->andReturn(true);
    $this->app->instance(WebPushDeliveryService::class, $push);
});

function pushSubscriptionFor(User $user): void
{
    PushSubscription::query()->create([
        'user_id' => $user->id,
        'endpoint' => 'https://push.example.test/'.bin2hex(random_bytes(6)),
        'keys' => ['p256dh' => 'test-key', 'auth' => 'test-auth'],
        'content_encoding' => 'aes128gcm',
    ]);
}

it('returns the same public response shape when no trusted device exists', function (): void {
    $response = $this->postJson('/api/v1/auth/push-login', ['mobile' => '9000000000']);

    $response->assertOk()->assertJsonStructure([
        'data' => ['challenge_id', 'request_secret', 'expires_at'],
    ]);

    expect(PushLoginChallenge::query()->first()?->user_id)->toBeNull();
});

it('allows the matching authenticated user to approve and exchange once', function (): void {
    $user = User::factory()->citizen()->create();
    pushSubscriptionFor($user);

    $request = $this->postJson('/api/v1/auth/push-login', ['mobile' => $user->mobile])->assertOk();
    $challenge = PushLoginChallenge::query()->findOrFail($request->json('data.challenge_id'));

    // The plaintext approval secret is delivered only in the encrypted push.
    // Replace the hash here to emulate the token received by that trusted device.
    $approvalSecret = str_repeat('a', 64);
    $challenge->update(['approval_secret_hash' => hash('sha256', $approvalSecret)]);

    Sanctum::actingAs($user);
    $this->postJson("/api/v1/auth/push-login/{$challenge->id}/approve", [
        'approval_secret' => $approvalSecret,
    ])->assertOk()->assertJsonPath('data.status', 'approved');

    $exchange = $this->postJson("/api/v1/auth/push-login/{$challenge->id}/exchange", [
        'request_secret' => $request->json('data.request_secret'),
    ]);
    $exchange->assertOk()
        ->assertJsonPath('data.status', 'approved')
        ->assertJsonStructure(['data' => ['token' => ['access_token'], 'refresh_token', 'user']]);

    $this->postJson("/api/v1/auth/push-login/{$challenge->id}/exchange", [
        'request_secret' => $request->json('data.request_secret'),
    ])->assertOk()->assertJsonPath('data.status', 'consumed');
});

it('prevents another signed-in account from approving the challenge', function (): void {
    $user = User::factory()->citizen()->create();
    $other = User::factory()->citizen()->create();
    pushSubscriptionFor($user);

    $request = $this->postJson('/api/v1/auth/push-login', ['mobile' => $user->mobile])->assertOk();
    $challenge = PushLoginChallenge::query()->findOrFail($request->json('data.challenge_id'));
    $approvalSecret = str_repeat('b', 64);
    $challenge->update(['approval_secret_hash' => hash('sha256', $approvalSecret)]);

    Sanctum::actingAs($other);
    $this->postJson("/api/v1/auth/push-login/{$challenge->id}/approve", [
        'approval_secret' => $approvalSecret,
    ])->assertForbidden();

    expect($challenge->refresh()->status)->toBe('pending');
});

it('does not exchange an expired approval request', function (): void {
    $user = User::factory()->citizen()->create();
    pushSubscriptionFor($user);
    $request = $this->postJson('/api/v1/auth/push-login', ['mobile' => $user->mobile])->assertOk();
    $challenge = PushLoginChallenge::query()->findOrFail($request->json('data.challenge_id'));
    $challenge->update(['status' => 'approved', 'expires_at' => now()->subSecond()]);

    $this->postJson("/api/v1/auth/push-login/{$challenge->id}/exchange", [
        'request_secret' => $request->json('data.request_secret'),
    ])->assertOk()->assertJsonPath('data.status', 'expired');

    expect($user->tokens()->count())->toBe(0);
});
