<?php

declare(strict_types=1);

use App\Modules\TextileCollections\Services\TextileRouteOptimizer;

it('orders mapped collections by nearest neighbour from the zone centre', function (): void {
    $ordered = TextileRouteOptimizer::optimize([
        ['id' => 'far', 'latitude' => 12.98, 'longitude' => 77.60],
        ['id' => 'near', 'latitude' => 12.91, 'longitude' => 77.58],
        ['id' => 'middle', 'latitude' => 12.94, 'longitude' => 77.59],
    ], 12.90, 77.58);

    expect($ordered)->toBe(['near', 'middle', 'far']);
});

it('keeps address-only collections in stable order after mapped collections', function (): void {
    $ordered = TextileRouteOptimizer::optimize([
        ['id' => 'missing-a', 'latitude' => null, 'longitude' => null],
        ['id' => 'mapped', 'latitude' => 12.91, 'longitude' => 77.58],
        ['id' => 'missing-b', 'latitude' => null, 'longitude' => null],
    ], 12.90, 77.58);

    expect($ordered)->toBe(['mapped', 'missing-a', 'missing-b']);
});
