<?php

declare(strict_types=1);

use App\Modules\Departments\Models\City;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Departments\Models\District;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);


it('creates the cities table with the required columns', function (): void {
    expect(Schema::hasTable('cities'))->toBeTrue();

    foreach (['id', 'district_id', 'name', 'code', 'active', 'created_at', 'updated_at'] as $c) {
        expect(Schema::hasColumn('cities', $c))->toBeTrue("cities.{$c} must exist");
    }
});

it('enforces a FK from cities.district_id to districts.id', function (): void {
    expect(fn () => City::factory()->create(['district_id' => '00000000-0000-0000-0000-000000000000']))
        ->toThrow(QueryException::class);
});

it('enforces unique (district_id, code)', function (): void {
    $parent = District::factory()->create();
    City::factory()->create(['district_id' => $parent->id, 'code' => 'AB']);

    expect(fn () => City::factory()->create(['district_id' => $parent->id, 'code' => 'AB']))
        ->toThrow(QueryException::class);
});

it('belongs to a district', function (): void {
    $parent = District::factory()->create();
    $row = City::factory()->create(['district_id' => $parent->id]);

    expect($row->district)->toBeInstanceOf(District::class)
        ->and($row->district->id)->toBe($parent->id);
});
