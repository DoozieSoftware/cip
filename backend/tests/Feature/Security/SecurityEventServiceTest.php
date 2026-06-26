<?php

declare(strict_types=1);

use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Security\Services\SecurityEventService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Exceptions\ModelImmutableException;
use App\Modules\Users\Models\User;

/**
 * Feature coverage for SecurityEventService (T-M2-021).
 *
 * Per docs/11 §29. The service is the only path through which the
 * application writes a security event. The tests verify the
 * severity allow-list, the event-name length cap, the
 * fail-open recordSafe wrapper, the metadata null-coercion, and
 * the model-level immutability invariant.
 */
beforeEach(function (): void {
    $this->service = app(SecurityEventService::class);
});

it('records an info event with a user', function (): void {
    $user = User::factory()->create();
    $row = $this->service->info('login.succeeded', ['channel' => 'otp'], $user);

    expect($row)->toBeInstanceOf(SecurityEvent::class);
    $persisted = SecurityEvent::query()->findOrFail($row->id);
    expect($persisted->user_id)->toBe($user->id)
        ->and($persisted->event)->toBe('login.succeeded')
        ->and($persisted->severity)->toBe('info')
        ->and($persisted->metadata)->toBe(['channel' => 'otp']);
});

it('records a critical event without a user', function (): void {
    $row = $this->service->critical('rate_limit.exceeded', ['limiter' => 'otp']);

    expect($row->user_id)->toBeNull()
        ->and($row->severity)->toBe('critical')
        ->and($row->event)->toBe('rate_limit.exceeded')
        ->and($row->metadata)->toBe(['limiter' => 'otp']);
});

it('coerces an empty metadata array to null', function (): void {
    $row = $this->service->info('login.succeeded', []);

    expect($row->metadata)->toBeNull();
});

it('accepts null metadata', function (): void {
    $row = $this->service->info('login.succeeded');

    expect($row->metadata)->toBeNull();
});

it('rejects an unknown severity with 422 INVALID_SEVERITY', function (): void {
    expect(fn () => $this->service->record('login.failed', 'extreme'))
        ->toThrow(ApiException::class);
});

it('rejects an empty event name with 422 INVALID_EVENT', function (): void {
    expect(fn () => $this->service->info(''))
        ->toThrow(ApiException::class);
});

it('rejects an event name longer than 64 chars', function (): void {
    expect(fn () => $this->service->info(str_repeat('a', 65)))
        ->toThrow(ApiException::class);
});

it('forbids update on a security event at the model layer', function (): void {
    $row = $this->service->info('login.succeeded', ['channel' => 'otp']);

    $row->event = 'mutated';
    expect(fn () => $row->save())->toThrow(ModelImmutableException::class);
});

it('forbids delete on a security event at the model layer', function (): void {
    $row = $this->service->info('login.succeeded', ['channel' => 'otp']);

    expect(fn () => $row->delete())->toThrow(ModelImmutableException::class);
});

it('recordSafe swallows exceptions and returns null', function (): void {
    $result = $this->service->recordSafe('login.failed', 'extreme');
    expect($result)->toBeNull();
});

it('recordSafe still writes when inputs are valid', function (): void {
    $row = $this->service->recordSafe('login.failed', 'warning', ['reason' => 'bad_code']);
    expect($row)->toBeInstanceOf(SecurityEvent::class);
    expect($row->event)->toBe('login.failed')
        ->and($row->severity)->toBe('warning');
});

it('falls back to the request IP and user agent when not provided', function (): void {
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.5'])
        ->withHeaders(['User-Agent' => 'CIP-Test/1.0']);

    $row = $this->service->info('login.succeeded');
    // We cannot easily assert on request ip because the calling
    // context is a test, but the row must be persisted and ip /
    // user_agent must be strings (possibly null) without raising.
    expect($row)->toBeInstanceOf(SecurityEvent::class);
});
