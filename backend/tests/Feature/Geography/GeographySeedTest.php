<?php

declare(strict_types=1);

use App\Modules\Departments\Models\City;
use App\Modules\Departments\Models\Country;
use App\Modules\Departments\Models\District;
use App\Modules\Departments\Models\State;
use App\Modules\Departments\Models\Ward;
use App\Modules\Departments\Models\Zone;
use Database\Seeders\GeographySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds the expected India / Karnataka / Bangalore tree on first run', function (): void {
    (new GeographySeeder)->run();

    expect(Country::query()->where('iso2', 'IN')->count())->toBe(1)
        ->and(State::query()->where('code', 'KA')->count())->toBe(1)
        ->and(District::query()->whereIn('code', ['KA-BU', 'KA-BR'])->count())->toBe(2)
        ->and(City::query()->where('code', 'BLR-CITY')->count())->toBe(1)
        ->and(Zone::query()->whereIn('code', ['BLR-EAST', 'BLR-WEST', 'BLR-SOUTH'])->count())->toBe(3)
        ->and(Ward::query()->where('municipality', 'BBMP')->count())->toBe(6)
        ->and(Ward::query()->where('municipality', 'TMC')->count())->toBe(2);
});

it('is idempotent — a second run does not duplicate rows', function (): void {
    (new GeographySeeder)->run();
    (new GeographySeeder)->run();

    expect(Country::query()->where('iso2', 'IN')->count())->toBe(1)
        ->and(State::query()->where('code', 'KA')->count())->toBe(1)
        ->and(District::query()->whereIn('code', ['KA-BU', 'KA-BR'])->count())->toBe(2)
        ->and(City::query()->count())->toBe(2)
        ->and(Zone::query()->count())->toBe(3)
        ->and(Ward::query()->count())->toBe(8);
});

it('assigns a non-null WKT boundary polygon to every ward', function (): void {
    (new GeographySeeder)->run();

    Ward::query()->each(function (Ward $ward): void {
        expect($ward->boundary_polygon)->toBeString()
            ->and(strtoupper($ward->boundary_polygon))->toStartWith('POLYGON((')
            ->and($ward->active)->toBeTrue();
    });
});

it('keys wards by city + ward_number so a later row does not collide', function (): void {
    (new GeographySeeder)->run();

    $bengaluru = City::query()->where('code', 'BLR-CITY')->firstOrFail();
    $wardOne = Ward::query()
        ->where('city_id', $bengaluru->id)
        ->where('ward_number', 1)
        ->firstOrFail();

    expect($wardOne->name)->toBe('Jeevan Bima Nagar');

    // A ward with the same ward_number in a different city must
    // not collide (D-019 / D-020 — composite key).
    $doddaballapur = City::query()->where('code', 'DDP')->firstOrFail();
    $dWardOne = Ward::query()
        ->where('city_id', $doddaballapur->id)
        ->where('ward_number', 1)
        ->firstOrFail();
    expect($dWardOne->name)->toBe('Doddaballapur Town')
        ->and($dWardOne->id)->not->toBe($wardOne->id);
});

it('rolls back cleanly when invoked inside RefreshDatabase', function (): void {
    (new GeographySeeder)->run();
    expect(Country::query()->count())->toBeGreaterThan(0);

    // The RefreshDatabase trait rolls back the transaction at
    // the end of the test — verify the rollback by re-querying
    // in a fresh transaction-less context.
    DB::rollBack();
    expect(Country::query()->count())->toBe(0);
    DB::beginTransaction();
});
