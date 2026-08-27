<?php

declare(strict_types=1);

use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

it('returns 200 with the active textile service zones for an authenticated citizen', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    TextileServiceZone::create([
        'code' => 'DRL-TEST-A',
        'name' => 'Indiranagar',
        'center_latitude' => 12.9716,
        'center_longitude' => 77.6411,
        'service_radius_km' => 10,
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'dropoff_name' => 'Indiranagar drop point',
        'dropoff_address' => '100ft road, Indiranagar',
        'readiness_instructions' => 'Pack dry.',
        'active' => true,
    ]);

    $response = $this->getJson('/api/v1/textile-collection/zones');

    $response->assertOk();
    $payload = $response->json('data');
    expect($payload)->toBeArray()
        ->and($payload[0])->toHaveKeys([
            'id', 'code', 'name', 'methods', 'dropoff', 'readiness_instructions',
        ])
        ->and($payload[0]['code'])->toBe('DRL-TEST-A')
        ->and($payload[0]['methods'])->toContain('dropoff')
        ->and($payload[0]['methods'])->toContain('premises');
});

it('filters out inactive zones from the public list', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    TextileServiceZone::create([
        'code' => 'DRL-ACTIVE',
        'name' => 'Active',
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'active' => true,
    ]);
    TextileServiceZone::create([
        'code' => 'DRL-INACTIVE',
        'name' => 'Inactive',
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'active' => false,
    ]);

    $response = $this->getJson('/api/v1/textile-collection/zones');
    $response->assertOk();
    $codes = collect($response->json('data'))->pluck('code')->all();

    expect($codes)->toContain('DRL-ACTIVE')
        ->and($codes)->not->toContain('DRL-INACTIVE');
});

it('rejects an unauthenticated zones request with 401', function (): void {
    $this->getJson('/api/v1/textile-collection/zones')
        ->assertUnauthorized();
});
