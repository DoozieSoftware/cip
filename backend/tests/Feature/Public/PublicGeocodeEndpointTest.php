<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Cache::flush();
});

it('finds a typed address through the configured geocoder proxy', function (): void {
    Http::fake([
        '*' => Http::response([[
            'lat' => '12.9352',
            'lon' => '77.6245',
            'display_name' => 'Jayanagar, Bengaluru, Karnataka',
        ]]),
    ]);

    $this->getJson('/api/v1/public/geocode?q=Jayanagar%2C%20Bengaluru')
        ->assertOk()
        ->assertJsonPath('data.geocoded', true)
        ->assertJsonPath('data.latitude', 12.9352)
        ->assertJsonPath('data.longitude', 77.6245)
        ->assertJsonPath('data.label', 'Jayanagar, Bengaluru, Karnataka');

    Http::assertSent(fn ($request): bool => $request->url() === config('services.geocoder.search_url')
        && $request['q'] === 'Jayanagar, Bengaluru'
        && $request['limit'] === 1);
});

it('validates typed address searches', function (): void {
    $this->getJson('/api/v1/public/geocode?q=x')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['q']);

    Http::assertNothingSent();
});

it('retries a simplified landmark query when a detailed address has no match', function (): void {
    Http::fakeSequence()
        ->push([], 200)
        ->push([[
            'lat' => '12.9797454',
            'lon' => '77.5906167',
            'display_name' => 'Vidhana Soudha, Bengaluru, Karnataka 560001',
        ]], 200);

    $this->getJson('/api/v1/public/geocode?q=Vidhana%20Soudha%2C%20Ambedkar%20Veedhi%2C%20Sampangi%20Rama%20Nagara%2C%20Bengaluru%2C%20Karnataka%20560001')
        ->assertOk()
        ->assertJsonPath('data.geocoded', true)
        ->assertJsonPath('data.latitude', 12.9797454)
        ->assertJsonPath('data.longitude', 77.5906167);

    Http::assertSentCount(2);
});
