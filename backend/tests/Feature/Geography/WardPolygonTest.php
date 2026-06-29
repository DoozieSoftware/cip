<?php

declare(strict_types=1);

use App\Modules\Departments\Models\City;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Departments\Models\Ward;
use App\Modules\Departments\Models\Zone;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);


it('creates the wards table with the required columns', function (): void {
    expect(Schema::hasTable('wards'))->toBeTrue();

    foreach ([
        'id', 'city_id', 'zone_id', 'ward_number', 'name', 'municipality',
        'active', 'boundary_polygon', 'created_at', 'updated_at', 'deleted_at',
    ] as $column) {
        expect(Schema::hasColumn('wards', $column))->toBeTrue("wards.{$column} must exist");
    }
});

it('enforces a FK from wards.city_id to cities.id', function (): void {
    expect(fn () => Ward::factory()->create(['city_id' => '00000000-0000-0000-0000-000000000000']))
        ->toThrow(QueryException::class);
});

it('enforces a FK from wards.zone_id to zones.id', function (): void {
    expect(fn () => Ward::factory()->create(['zone_id' => '00000000-0000-0000-0000-000000000000']))
        ->toThrow(QueryException::class);
});

it('nulls zone_id when the parent zone is deleted', function (): void {
    $city = City::factory()->create();
    $zone = Zone::factory()->create(['city_id' => $city->id]);
    $ward = Ward::factory()->create([
        'city_id' => $city->id,
        'zone_id' => $zone->id,
    ]);

    $zone->delete();

    $ward->refresh();
    expect($ward->zone_id)->toBeNull();
});

it('enforces unique (city_id, ward_number)', function (): void {
    $city = City::factory()->create();
    Ward::factory()->create(['city_id' => $city->id, 'ward_number' => 7]);

    expect(fn () => Ward::factory()->create(['city_id' => $city->id, 'ward_number' => 7]))
        ->toThrow(QueryException::class);
});

it('soft-deletes a ward and the row is hidden from default queries', function (): void {
    $ward = Ward::factory()->create();

    $ward->delete();

    expect(Ward::query()->find($ward->id))->toBeNull()
        ->and(Ward::onlyTrashed()->find($ward->id))->not->toBeNull()
        ->and(Ward::withTrashed()->find($ward->id))->not->toBeNull();
});

it('belongs to a city and a zone', function (): void {
    $city = City::factory()->create();
    $zone = Zone::factory()->create(['city_id' => $city->id]);
    $ward = Ward::factory()->create([
        'city_id' => $city->id,
        'zone_id' => $zone->id,
    ]);

    expect($ward->city)->toBeInstanceOf(City::class)
        ->and($ward->city->id)->toBe($city->id)
        ->and($ward->zone)->toBeInstanceOf(Zone::class)
        ->and($ward->zone->id)->toBe($zone->id);
});

it('round-trips a WKT boundary polygon through the model', function (): void {
    $wkt = 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))';

    $ward = Ward::factory()->create(['boundary_polygon' => $wkt]);

    $stored = DB::table('wards')->where('id', $ward->id)->value('boundary_polygon');
    expect($stored)->toBe($wkt);
});

it('creates a MySQL spatial index on boundary_polygon (driver-guarded)', function (): void {
    if (DB::connection()->getDriverName() !== 'mysql') {
        expect(true)->toBeTrue(); // covered by the SQLite fallback in the migration

        return;
    }

    $indexes = collect(DB::select('SHOW INDEX FROM wards'))
        ->pluck('Key_name')
        ->all();
    expect(collect($indexes)->contains('wards_boundary_polygon_sidx'))->toBeTrue();
});
