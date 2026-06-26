<?php

declare(strict_types=1);

use App\Modules\Shared\Http\Responses\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

it('returns the success envelope with data and meta', function (): void {
    $response = ApiResponse::success(['id' => 1], 'Created', 201, ['trace' => 'abc']);
    $payload = $response->getData(true);
    expect($response->getStatusCode())->toBe(201);
    expect($payload['success'])->toBeTrue();
    expect($payload['message'])->toBe('Created');
    expect($payload['data'])->toBe(['id' => 1]);
    expect($payload['meta'])->toBe(['trace' => 'abc']);
});

it('returns the error envelope with trace_id and code', function (): void {
    $request = request();

    if (! $request instanceof Request) {
        $request = Request::create('/');
    }
    $request->attributes->set('trace_id', 'trace-xyz');
    Illuminate\Support\Facades\Request::swap($request);

    $response = ApiResponse::error('Bad request', 400, 'BAD_THING', ['field' => 'required']);
    $payload = $response->getData(true);
    expect($response->getStatusCode())->toBe(400);
    expect($payload['success'])->toBeFalse();
    expect($payload['message'])->toBe('Bad request');
    expect($payload['code'])->toBe('BAD_THING');
    expect($payload['errors'])->toBe(['field' => 'required']);
    expect($payload['trace_id'])->toBe('trace-xyz');
});

it('paginates a LengthAwarePaginator', function (): void {
    $paginator = new LengthAwarePaginator(
        items: [['id' => 1], ['id' => 2]],
        total: 10,
        perPage: 2,
        currentPage: 1,
    );
    $response = ApiResponse::paginated($paginator, 'OK');
    $payload = $response->getData(true);
    expect($payload['success'])->toBeTrue();
    expect($payload['data'])->toBe([['id' => 1], ['id' => 2]]);
    expect($payload['meta']['total'])->toBe(10);
    expect($payload['meta']['per_page'])->toBe(2);
    expect($payload['meta']['page'])->toBe(1);
    expect($payload['meta']['last_page'])->toBe(5);
});
