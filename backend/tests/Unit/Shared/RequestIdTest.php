<?php

declare(strict_types=1);

use App\Modules\Shared\Http\Middleware\RequestId;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

it('generates a UUID when no header is provided', function (): void {
    $middleware = new RequestId;
    $request = Request::create('/api/v1/health', 'GET');
    $response = $middleware->handle($request, fn (): Response => response('ok'));
    $header = $response->headers->get(RequestId::HEADER);
    expect($header)->not->toBeNull();
    expect($header)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i');
});

it('echoes the inbound trace id when provided', function (): void {
    $middleware = new RequestId;
    $request = Request::create('/api/v1/health', 'GET', server: ['HTTP_X_REQUEST_ID' => 'client-trace-42']);
    $response = $middleware->handle($request, fn () => response('ok'));
    expect($response->headers->get(RequestId::HEADER))->toBe('client-trace-42');
    expect($request->attributes->get(RequestId::ATTRIBUTE))->toBe('client-trace-42');
});
