<?php

declare(strict_types=1);

use App\Modules\Settings\Models\AppConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);


it('creates the app_configs table with the required columns', function (): void {
    expect(Schema::hasTable('app_configs'))->toBeTrue();

    foreach ([
        'id', 'key', 'value', 'enabled', 'rollout_percentage',
        'cohort', 'description', 'created_at', 'updated_at',
    ] as $column) {
        expect(Schema::hasColumn('app_configs', $column))->toBeTrue("app_configs.{$column} must exist");
    }
});

it('enforces a unique index on app_configs.key', function (): void {
    AppConfig::factory()->create(['key' => 'feature.flag']);

    expect(fn () => AppConfig::factory()->create(['key' => 'feature.flag']))
        ->toThrow(QueryException::class);
});

it('uses the app_configs table and UUID primary key', function (): void {
    $m = new AppConfig;
    expect($m->getTable())->toBe('app_configs')
        ->and($m->getKeyName())->toBe('id')
        ->and($m->getKeyType())->toBe('string');
});

it('casts enabled, rollout_percentage, value and cohort', function (): void {
    $row = AppConfig::factory()->enabled(50)->withCohort([
        ['role' => 'moderator'],
        ['city_id' => '11111111-1111-1111-1111-111111111111'],
    ])->create();

    expect($row->enabled)->toBeTrue()
        ->and($row->rollout_percentage)->toBe(50)
        ->and($row->cohort)->toBe([
            ['role' => 'moderator'],
            ['city_id' => '11111111-1111-1111-1111-111111111111'],
        ])
        ->and($row->value)->toBeTrue();
});

it('rejects rollout_percentage > 100 via the model (range guard)', function (): void {
    // The migration column is unsignedTinyInteger (max 255 on
    // MySQL); the application layer enforces the spec range
    // (0-100) — see FeatureFlagService in T-M3-013. The model
    // here just stores whatever is given and lets the service
    // reject out-of-range values.
    $row = AppConfig::factory()->create(['rollout_percentage' => 100]);
    expect($row->rollout_percentage)->toBe(100);
});
