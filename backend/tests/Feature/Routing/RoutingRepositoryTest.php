<?php

declare(strict_types=1);

use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Repositories\RoutingRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Cache::flush();
});

it('returns the active rule set from the database on the first call', function (): void {
    RoutingRule::factory()->count(3)->create();
    $inactive = RoutingRule::factory()->create(['active' => false]);
    $softDeleted = RoutingRule::factory()->create();
    $softDeleted->delete();

    $repo = new RoutingRepository;
    $rules = $repo->activeRules();

    expect($rules)->toHaveCount(3);
    expect($rules->pluck('id'))->not->toContain($inactive->id);
    expect($rules->pluck('id'))->not->toContain($softDeleted->id);
});

it('serves the second call from the cache (no extra DB query)', function (): void {
    RoutingRule::factory()->count(2)->create();
    $repo = new RoutingRepository;

    $first = $repo->activeRules();
    expect($first)->toHaveCount(2);

    // Mutate the DB without invalidating the cache.
    RoutingRule::factory()->create();

    $second = $repo->activeRules();
    expect($second)->toHaveCount(2)
        ->and($second->pluck('id')->all())->toEqual($first->pluck('id')->all());
});

it('invalidate() flushes the routing cache tag so the next call re-reads the DB', function (): void {
    $repo = new RoutingRepository;
    RoutingRule::factory()->count(2)->create();
    $first = $repo->activeRules();
    expect($first)->toHaveCount(2);

    // Add a third rule and invalidate.
    RoutingRule::factory()->create();
    $repo->invalidate();

    $after = $repo->activeRules();
    expect($after)->toHaveCount(3);
});

it('keeps the order stable (priority asc, id asc)', function (): void {
    $a = RoutingRule::factory()->create(['priority' => 100]);
    $b = RoutingRule::factory()->create(['priority' => 10]);
    $c = RoutingRule::factory()->create(['priority' => 50]);

    $repo = new RoutingRepository;
    $ids = $repo->activeRules()->pluck('id')->all();

    expect($ids[0])->toBe($b->id)
        ->and($ids[1])->toBe($c->id)
        ->and($ids[2])->toBe($a->id);
});

it('uses the "routing" cache tag for surgical invalidation', function (): void {
    $repo = new RoutingRepository;
    expect($repo::CACHE_TAG)->toBe('routing')
        ->and($repo::CACHE_TTL_SECONDS)->toBe(3600);
});
