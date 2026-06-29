<?php

declare(strict_types=1);

use App\Modules\Departments\DTOs\GeographyDTO;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Departments\Models\City;
use App\Modules\Departments\Models\Country;
use App\Modules\Departments\Models\District;
use App\Modules\Departments\Models\State;
use App\Modules\Departments\Models\Ward;
use App\Modules\Departments\Models\Zone;
use App\Modules\Departments\Repositories\GeographyRepository;
use App\Modules\Departments\Services\GeographyService;
use App\Modules\Shared\Exceptions\ApiException;

uses(RefreshDatabase::class);


it('lists countries paginated', function (): void {
    Country::factory()->count(3)->create();

    $page = (new GeographyService(new GeographyRepository))->listCountries(perPage: 2);

    expect($page->total())->toBe(3)
        ->and($page->perPage())->toBe(2)
        ->and($page->items())->toHaveCount(2);
});

it('returns states-by-country paginated', function (): void {
    $country = Country::factory()->create();
    State::factory()->count(3)->create(['country_id' => $country->id]);
    State::factory()->count(2)->create(); // other country, must be excluded

    $page = (new GeographyService(new GeographyRepository))->getStatesByCountry($country->id, 2);

    expect($page->total())->toBe(3);
});

it('returns districts-by-state, cities-by-district, zones-by-city, wards-by-city paginated', function (): void {
    $country = Country::factory()->create();
    $state = State::factory()->create(['country_id' => $country->id]);
    $district = District::factory()->create(['state_id' => $state->id]);
    $city = City::factory()->create(['district_id' => $district->id]);
    Zone::factory()->count(2)->create(['city_id' => $city->id]);
    Ward::factory()->count(3)->create(['city_id' => $city->id, 'zone_id' => null]);

    $service = new GeographyService(new GeographyRepository);

    expect($service->getDistrictsByState($state->id)->total())->toBe(1)
        ->and($service->getCitiesByDistrict($district->id)->total())->toBe(1)
        ->and($service->getZonesByCity($city->id)->total())->toBe(2)
        ->and($service->getWardsByCity($city->id)->total())->toBe(3);
});

it('upserts a country by iso2', function (): void {
    $service = new GeographyService(new GeographyRepository);
    $country = $service->upsert(GeographyDTO::fromArray('country', [
        'name' => 'India',
        'code' => 'in',  // lowercased on purpose — should be normalised to IN
        'iso3' => 'IND',
        'phone_code' => '+91',
    ]));

    expect($country->name)->toBe('India')
        ->and($country->iso2)->toBe('IN')
        ->and($country->iso3)->toBe('IND')
        ->and($country->phone_code)->toBe('+91');
});

it('upserts a state by (country_id, code)', function (): void {
    $country = Country::factory()->create();
    $service = new GeographyService(new GeographyRepository);

    $state = $service->upsert(GeographyDTO::fromArray('state', [
        'name' => 'Karnataka',
        'code' => 'ka',
        'parent_id' => $country->id,
    ]));

    expect($state->name)->toBe('Karnataka')
        ->and($state->code)->toBe('KA')
        ->and($state->country_id)->toBe($country->id);
});

it('upserts a district / city / zone / ward through the same service', function (): void {
    $country = Country::factory()->create();
    $state = State::factory()->create(['country_id' => $country->id]);
    $district = District::factory()->create(['state_id' => $state->id]);
    $city = City::factory()->create(['district_id' => $district->id]);
    $zone = Zone::factory()->create(['city_id' => $city->id]);

    $service = new GeographyService(new GeographyRepository);

    $ward = $service->upsert(GeographyDTO::fromArray('ward', [
        'name' => 'Ward 7',
        'parent_id' => $city->id,
        'ward_number' => 7,
        'zone_id' => $zone->id,
        'municipality' => 'BBMP',
        'boundary_polygon' => 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))',
    ]));

    expect($ward->name)->toBe('Ward 7')
        ->and($ward->city_id)->toBe($city->id)
        ->and($ward->zone_id)->toBe($zone->id)
        ->and($ward->ward_number)->toBe(7)
        ->and($ward->boundary_polygon)->toBe('POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))');
});

it('rejects an unknown geography level', function (): void {
    $service = new GeographyService(new GeographyRepository);
    expect(fn () => $service->upsert(GeographyDTO::fromArray('village', ['name' => 'X', 'code' => 'X'])))
        ->toThrow(ApiException::class);
});

it('rejects a ward without ward_number', function (): void {
    $city = City::factory()->create();
    $service = new GeographyService(new GeographyRepository);

    expect(fn () => $service->upsert(GeographyDTO::fromArray('ward', [
        'name' => 'NoNumber',
        'parent_id' => $city->id,
    ])))->toThrow(ApiException::class);
});

it('rejects a state without a parent country', function (): void {
    $service = new GeographyService(new GeographyRepository);
    expect(fn () => $service->upsert(GeographyDTO::fromArray('state', [
        'name' => 'Orphan',
        'code' => 'OR',
    ])))->toThrow(ApiException::class);
});
