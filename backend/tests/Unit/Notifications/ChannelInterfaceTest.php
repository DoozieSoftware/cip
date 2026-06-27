<?php

declare(strict_types=1);

use App\Modules\Notifications\Contracts\ChannelInterface;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;

it('ChannelResult::ok() returns a success result with latency and response', function (): void {
    $r = ChannelResult::ok(latencyMs: 87, providerResponse: ['message_id' => 'fcm-1234']);

    expect($r->success)->toBeTrue()
        ->and($r->error)->toBeNull()
        ->and($r->latencyMs)->toBe(87)
        ->and($r->providerResponse)->toBe(['message_id' => 'fcm-1234'])
        ->and($r->isTransient)->toBeTrue();
});

it('ChannelResult::fail() defaults to transient with no latency', function (): void {
    $r = ChannelResult::fail(error: 'upstream 502');

    expect($r->success)->toBeFalse()
        ->and($r->error)->toBe('upstream 502')
        ->and($r->latencyMs)->toBeNull()
        ->and($r->isTransient)->toBeTrue();
});

it('ChannelResult::fail() can be marked non-transient for permanent errors', function (): void {
    $r = ChannelResult::fail(error: 'invalid email', transient: false, latencyMs: 5);

    expect($r->success)->toBeFalse()
        ->and($r->isTransient)->toBeFalse()
        ->and($r->latencyMs)->toBe(5);
});

it('ChannelResult::toArray() exposes the canonical shape', function (): void {
    $r = ChannelResult::fail(error: 'boom', transient: false, latencyMs: 12, providerResponse: ['k' => 'v']);

    expect($r->toArray())->toBe([
        'success' => false,
        'error' => 'boom',
        'latency_ms' => 12,
        'provider_response' => ['k' => 'v'],
        'is_transient' => false,
    ]);
});

it('a class that implements ChannelInterface can be type-checked', function (): void {
    $impl = new class implements ChannelInterface
    {
        public function send(Notification $n, NotificationTemplate $t): ChannelResult
        {
            return ChannelResult::ok(latencyMs: 1);
        }
    };

    expect($impl)->toBeInstanceOf(ChannelInterface::class);
});
