<?php

declare(strict_types=1);

use App\Modules\Shared\Support\TraceContext;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

uses(TestCase::class);
it('uses the inbound request id for queue payloads and connector headers', function (): void {
    $request = Request::create('/api/v1/health', 'GET');
    $request->attributes->set('trace_id', 'trace-from-http');
    app()->instance('request', $request);

    expect(TraceContext::payload())->toBe(['trace_id' => 'trace-from-http'])
        ->and(TraceContext::headers())->toBe(['X-Request-Id' => 'trace-from-http']);
});

it('generates a correlation id when a job is dispatched without an http request', function (): void {
    app()->forgetInstance('request');

    $payload = TraceContext::payload();

    expect($payload['trace_id'])->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i');
});

it('adds a queued job id to the shared log context', function (): void {
    $job = Mockery::mock(Job::class);
    $job->shouldReceive('payload')->once()->andReturn(['trace_id' => 'trace-from-queue']);
    Log::spy();

    TraceContext::applyToJob($job);

    Log::shouldHaveReceived('withContext')
        ->once()
        ->with(['trace_id' => 'trace-from-queue']);
});
