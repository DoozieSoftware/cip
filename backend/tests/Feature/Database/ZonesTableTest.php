<?php

declare(strict_types=1);

use App\Modules\Departments\Models\City;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Departments\Models\Zone;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);


it('creates the zones table with the required columns', function (): void {
    expect(Schema::hasTable('zones'))->toBeTrue();

    foreach (['id', 'city_id', 'name', 'code', 'active', 'created_at', 'updated_at'] as $c) {
        expect(Schema::hasColumn('zones', $c))->toBeTrue("zones.{$c} must exist");
    }
});

it('enforces a FK from zones.city_id to cities.id', function (): void {
    expect(fn () => Zone::factory()->create(['city_id' => '00000000-0000-0000-0000-000000000000']))
        ->toThrow(QueryException::class);
});

it('enforces unique (city_id, code)', function (): void {
    $parent = City::factory()->create();
    Zone::factory()->create(['city_id' => $parent->id, 'code' => 'AB']);

    expect(fn () => Zone::factory()->create(['city_id' => $parent->id, 'code' => 'AB']))
        ->toThrow(QueryException::class);
});

it('belongs to a city', function (): void {
    $parent = City::factory()->create();
    $row = Zone::factory()->create(['city_id' => $parent->id]);

    expect($row->city)->toBeInstanceOf(City::class)
        ->and($row->city->id)->toBe($parent->id);
});
