<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Country;
use Database\Seeders\CountriesSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

it('creates the countries table with the required columns', function (): void {
    expect(Schema::hasTable('countries'))->toBeTrue();

    $expected = ['id', 'name', 'iso2', 'iso3', 'phone_code', 'active', 'created_at', 'updated_at'];

    foreach ($expected as $column) {
        expect(Schema::hasColumn('countries', $column))->toBeTrue("countries.{$column} must exist");
    }
});

it('uses a UUID primary key on countries', function (): void {
    $country = Country::factory()->create();
    expect($country->id)->toBeString()->toHaveLength(36);
});

it('enforces a unique index on iso2', function (): void {
    Country::factory()->create(['iso2' => 'IN']);

    expect(fn () => Country::factory()->create(['iso2' => 'IN']))
        ->toThrow(QueryException::class);
});

it('casts active to a boolean', function (): void {
    $country = Country::factory()->create(['active' => true]);
    expect($country->active)->toBeTrue();

    $country->active = false;
    $country->save();
    expect($country->fresh()->active)->toBeFalse();
});

it('seeds India idempotently', function (): void {
    (new CountriesSeeder)->run();
    (new CountriesSeeder)->run();

    $india = Country::query()->where('iso2', 'IN')->first();
    expect($india)->not->toBeNull()
        ->and($india->name)->toBe('India')
        ->and($india->iso3)->toBe('IND')
        ->and($india->phone_code)->toBe('+91');
});
