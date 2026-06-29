<?php

declare(strict_types=1);

use App\Modules\Departments\Models\District;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Departments\Models\State;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);


it('creates the districts table with the required columns', function (): void {
    expect(Schema::hasTable('districts'))->toBeTrue();

    foreach (['id', 'state_id', 'name', 'code', 'active', 'created_at', 'updated_at'] as $c) {
        expect(Schema::hasColumn('districts', $c))->toBeTrue("districts.{$c} must exist");
    }
});

it('enforces a FK from districts.state_id to states.id', function (): void {
    expect(fn () => District::factory()->create(['state_id' => '00000000-0000-0000-0000-000000000000']))
        ->toThrow(QueryException::class);
});

it('enforces unique (state_id, code)', function (): void {
    $state = State::factory()->create();
    District::factory()->create(['state_id' => $state->id, 'code' => 'BLR']);

    expect(fn () => District::factory()->create(['state_id' => $state->id, 'code' => 'BLR']))
        ->toThrow(QueryException::class);
});

it('belongs to a state', function (): void {
    $state = State::factory()->create();
    $district = District::factory()->create(['state_id' => $state->id]);

    expect($district->state)->toBeInstanceOf(State::class)
        ->and($district->state->id)->toBe($state->id);
});
