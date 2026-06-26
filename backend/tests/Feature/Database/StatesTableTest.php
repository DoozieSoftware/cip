<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Country;
use App\Modules\Departments\Models\State;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

it('creates the states table with the required columns', function (): void {
    expect(Schema::hasTable('states'))->toBeTrue();

    foreach (['id', 'country_id', 'name', 'code', 'active', 'created_at', 'updated_at'] as $column) {
        expect(Schema::hasColumn('states', $column))->toBeTrue("states.{$column} must exist");
    }
});

it('enforces a FK from states.country_id to countries.id', function (): void {
    expect(fn () => State::factory()->create(['country_id' => '00000000-0000-0000-0000-000000000000']))
        ->toThrow(QueryException::class);
});

it('enforces unique (country_id, code)', function (): void {
    $country = Country::factory()->create();
    State::factory()->create(['country_id' => $country->id, 'code' => 'KA']);

    expect(fn () => State::factory()->create(['country_id' => $country->id, 'code' => 'KA']))
        ->toThrow(QueryException::class);
});

it('allows the same code in different countries', function (): void {
    $a = Country::factory()->create();
    $b = Country::factory()->create();
    State::factory()->create(['country_id' => $a->id, 'code' => 'KA']);
    State::factory()->create(['country_id' => $b->id, 'code' => 'KA']);

    expect(State::query()->where('code', 'KA')->count())->toBe(2);
});

it('belongs to a country', function (): void {
    $country = Country::factory()->create();
    $state = State::factory()->create(['country_id' => $country->id]);

    expect($state->country)->toBeInstanceOf(Country::class)
        ->and($state->country->id)->toBe($country->id);
});
