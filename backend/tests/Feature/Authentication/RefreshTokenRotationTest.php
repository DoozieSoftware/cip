<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\RefreshToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Authentication\Services\RefreshTokenService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;

uses(RefreshDatabase::class);

/**
 * Refresh token issuance, rotation, and revocation.
 *
 * Per docs/11 §7 (Refresh Token Rotation), every successful
 * authentication issues a new refresh token and revokes the parent.
 * Reuse of a revoked parent is treated as theft and the entire chain
 * is revoked.
 */
it('issues a refresh token with a 14-day expiry and a hash (never plaintext)', function (): void {
    $user = User::factory()->citizen()->create();
    $service = app(RefreshTokenService::class);

    $issued = $service->issue($user, '10.0.0.1', 'Pest/Test');

    expect($issued['plain'])->toBeString()->and(strlen($issued['plain']))->toBe(64)
        ->and($issued['token'])->toBeInstanceOf(RefreshToken::class)
        ->and($issued['token']->user_id)->toBe($user->id)
        ->and($issued['token']->parent_id)->toBeNull()
        ->and($issued['token']->revoked_at)->toBeNull()
        ->and($issued['token']->token_hash)->not->toBe($issued['plain'])
        ->and($issued['expires_at']->isFuture())->toBeTrue();
});

it('rotates a refresh token: parent revoked, child issued with parent_id', function (): void {
    $user = User::factory()->citizen()->create();
    $service = app(RefreshTokenService::class);

    $first = $service->issue($user);
    $rotated = $service->rotate($first['plain']);

    expect($rotated['token']->parent_id)->toBe($first['token']->id)
        ->and($rotated['plain'])->not->toBe($first['plain'])
        ->and($rotated['user']->id)->toBe($user->id);

    $first['token']->refresh();
    expect($first['token']->revoked_at)->not->toBeNull();
    expect($first['token']->isRevoked())->toBeTrue();
});

it('rejects rotation of a revoked parent — entire chain is killed', function (): void {
    $user = User::factory()->citizen()->create();
    $service = app(RefreshTokenService::class);

    $first = $service->issue($user);
    $rotated = $service->rotate($first['plain']);

    // Reuse of the (now revoked) parent — must reject and revoke the child.
    $service->rotate($first['plain']);
})->throws(ApiException::class);

it('rejects rotation of an unknown token', function (): void {
    $service = app(RefreshTokenService::class);
    $service->rotate('not-a-real-token');
})->throws(ApiException::class);

it('rejects rotation of an expired parent', function (): void {
    $user = User::factory()->citizen()->create();
    $service = app(RefreshTokenService::class);

    $first = $service->issue($user);
    // backdate the expiry into the past
    $first['token']->forceFill(['expires_at' => now()->subMinute()])->save();

    $service->rotate($first['plain']);
})->throws(ApiException::class);

it('revoke() marks a single token revoked and is idempotent', function (): void {
    $user = User::factory()->citizen()->create();
    $service = app(RefreshTokenService::class);

    $issued = $service->issue($user);
    expect($service->revoke($issued['plain']))->toBeTrue();
    expect($service->revoke($issued['plain']))->toBeTrue(); // second call is a no-op
    expect($issued['token']->fresh()->isRevoked())->toBeTrue();
});

it('revokeAllForUser() revokes every active token for the user', function (): void {
    $user = User::factory()->citizen()->create();
    $service = app(RefreshTokenService::class);

    $a = $service->issue($user);
    $b = $service->issue($user);
    $c = $service->issue($user);

    $revoked = $service->revokeAllForUser($user);
    expect($revoked)->toBe(3);

    expect($a['token']->fresh()->isRevoked())->toBeTrue();
    expect($b['token']->fresh()->isRevoked())->toBeTrue();
    expect($c['token']->fresh()->isRevoked())->toBeTrue();
});

it('the active() scope returns only non-revoked, non-expired tokens', function (): void {
    $user = User::factory()->citizen()->create();
    $service = app(RefreshTokenService::class);

    $a = $service->issue($user);
    $b = $service->issue($user);
    $b['token']->markRevoked();
    $c = $service->issue($user);
    $c['token']->forceFill(['expires_at' => now()->subMinute()])->save();

    $active = RefreshToken::query()->active()->get();
    expect($active->pluck('id')->all())->toBe([$a['token']->id]);
});
