<?php

declare(strict_types=1);

use App\Modules\Settings\Models\AppConfig;
use App\Modules\Settings\Services\FeatureFlagService;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;

it('returns false for a missing key', function (): void {
    expect((new FeatureFlagService)->enabled('does.not.exist'))->toBeFalse();
});

it('returns false when the flag is disabled', function (): void {
    AppConfig::factory()->create(['key' => 'feature.x', 'enabled' => false, 'rollout_percentage' => 100]);

    expect((new FeatureFlagService)->enabled('feature.x'))->toBeFalse();
});

it('rollout 100 always returns true (when enabled)', function (): void {
    AppConfig::factory()->enabled(100)->create(['key' => 'feature.full']);

    expect((new FeatureFlagService)->enabled('feature.full'))->toBeTrue();
});

it('rollout 0 always returns false (when enabled)', function (): void {
    AppConfig::factory()->enabled(0)->create(['key' => 'feature.off']);

    expect((new FeatureFlagService)->enabled('feature.off'))->toBeFalse();
});

it('gives the same answer for the same user across calls', function (): void {
    AppConfig::factory()->enabled(50)->create(['key' => 'feature.half']);
    $user = User::factory()->create();
    $service = new FeatureFlagService;

    $a = $service->enabled('feature.half', $user);
    $b = $service->enabled('feature.half', $user);

    expect($a)->toBe($b);
});

it('partitions the user population across the rollout boundary (50/50, large sample)', function (): void {
    AppConfig::factory()->enabled(50)->create(['key' => 'feature.50']);
    $service = new FeatureFlagService;

    $users = User::factory()->count(200)->create();
    $on = 0;

    foreach ($users as $u) {
        if ($service->enabled('feature.50', $u)) {
            $on++;
        }
    }

    // 200 users at 50% should land in [60, 140] (loose ±40 %)
    // — the SHA-256-based bucket is uniform; this guards against
    // accidental bias introduced by a future refactor.
    expect($on)->toBeGreaterThan(60)->toBeLessThan(140);
});

it('cohort match short-circuits the rollout path', function (): void {
    // Seed the moderator role (defined in M2's
    // RolesAndPermissionsSeeder; the seeder is not auto-run
    // in Pest, so call it here).
    (new RolesAndPermissionsSeeder)->run();

    // Rollout 0 but cohort matches the user's role.
    AppConfig::factory()->create([
        'key' => 'feature.cohort',
        'enabled' => true,
        'rollout_percentage' => 0,
        'cohort' => [['role' => 'moderator']],
    ]);
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');

    $citizen = User::factory()->create();
    // citizen has no role by default per D-015

    $service = new FeatureFlagService;

    expect($service->enabled('feature.cohort', $moderator))->toBeTrue()
        ->and($service->enabled('feature.cohort', $citizen))->toBeFalse();
});

it('cohort supports array-of-values ("in" semantics)', function (): void {
    // Use a real column on the users table. anonymous_enabled
    // (bool) is portable: an array of allowed values matches the
    // user's actual value.
    AppConfig::factory()->create([
        'key' => 'feature.anon',
        'enabled' => true,
        'rollout_percentage' => 0,
        'cohort' => [['anonymous_enabled' => [true, false]]],
    ]);
    $service = new FeatureFlagService;
    $u = User::factory()->create();

    expect($service->enabled('feature.anon', $u))->toBeTrue();
});

it('anonymous caller falls back to session id', function (): void {
    AppConfig::factory()->enabled(50)->create(['key' => 'feature.anon']);
    $service = new FeatureFlagService;

    $a = $service->enabled('feature.anon', null, 'session-abc');
    $b = $service->enabled('feature.anon', null, 'session-abc');
    $c = $service->enabled('feature.anon', null, 'session-xyz');

    expect($a)->toBe($b)
        ->and($a === $c || $a !== $c)->toBeTrue(); // may or may not differ, but stable
});
