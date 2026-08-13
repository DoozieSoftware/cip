<?php

declare(strict_types=1);

use App\Modules\Shared\Services\PlatformHeartbeatService;
use Illuminate\Support\Facades\Cache;

it('requires a current worker heartbeat for asynchronous queues', function (): void {
    Cache::flush();
    config([
        'queue.default' => 'database',
        'cip.health.required_queues' => 'default',
        'cip.health.heartbeat_ttl_seconds' => 180,
    ]);

    $heartbeats = app(PlatformHeartbeatService::class);

    expect($heartbeats->workerStatus()['ok'])->toBeFalse();

    $heartbeats->touchWorker('database', 'default');

    expect($heartbeats->workerStatus()['ok'])->toBeTrue();
});

it('does not require a worker for synchronous queues', function (): void {
    config(['queue.default' => 'sync']);

    expect(app(PlatformHeartbeatService::class)->workerStatus())
        ->toMatchArray(['ok' => true, 'message' => 'not required (queue:sync)']);
});

it('requires a scheduler heartbeat', function (): void {
    Cache::flush();
    config(['cip.health.heartbeat_ttl_seconds' => 180]);
    $heartbeats = app(PlatformHeartbeatService::class);

    expect($heartbeats->schedulerStatus()['ok'])->toBeFalse();

    $heartbeats->touchScheduler();

    expect($heartbeats->schedulerStatus()['ok'])->toBeTrue();
});
