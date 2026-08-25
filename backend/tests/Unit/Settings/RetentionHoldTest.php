<?php

declare(strict_types=1);

use App\Modules\Settings\Models\RetentionHold;
use Illuminate\Support\Carbon;
use Tests\TestCase;

uses(TestCase::class);
function retentionHold(array $attributes): RetentionHold
{
    $hold = new RetentionHold;
    $hold->setRawAttributes($attributes);

    return $hold;
}

it('recognizes an unreleased hold with no expiry as active', function (): void {
    $hold = retentionHold(['released_at' => null, 'expires_at' => null]);

    expect($hold->isActive(Carbon::parse('2026-08-12 10:00:00')))->toBeTrue();
});

it('treats released and expired holds as inactive', function (): void {
    $at = Carbon::parse('2026-08-12 10:00:00');
    $expired = retentionHold(['released_at' => null, 'expires_at' => $at->copy()->subSecond()->toDateTimeString()]);
    $released = retentionHold(['released_at' => $at->toDateTimeString(), 'expires_at' => null]);

    expect($expired->isActive($at))->toBeFalse()
        ->and($released->isActive($at))->toBeFalse();
});

it('keeps a hold active through its exact expiry instant', function (): void {
    $at = Carbon::parse('2026-08-12 10:00:00');
    $hold = retentionHold(['released_at' => null, 'expires_at' => $at->toDateTimeString()]);

    expect($hold->isActive($at))->toBeTrue();
});
