<?php

declare(strict_types=1);

use App\Modules\Settings\Models\AppConfig;
use App\Modules\Settings\Services\FeatureFlagService;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function flagSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

// --------------------------------------------------------------------------
// Service-level evaluation (the unit-level rules)
// --------------------------------------------------------------------------

it('returns false for a missing key (default behaviour)', function (): void {
    expect((new FeatureFlagService)->enabled('does.not.exist'))->toBeFalse();
});

it('returns false when the master switch is off, even at 100% rollout', function (): void {
    AppConfig::factory()->create([
        'key' => 'feature.killed',
        'enabled' => false,
        'rollout_percentage' => 100,
    ]);

    expect((new FeatureFlagService)->enabled('feature.killed'))->toBeFalse();
});

it('returns true at 100% rollout when the master switch is on', function (): void {
    AppConfig::factory()->enabled(100)->create(['key' => 'feature.full']);

    expect((new FeatureFlagService)->enabled('feature.full'))->toBeTrue();
});

it('returns false at 0% rollout when the master switch is on', function (): void {
    AppConfig::factory()->enabled(0)->create(['key' => 'feature.empty']);

    expect((new FeatureFlagService)->enabled('feature.empty'))->toBeFalse();
});

it('is deterministic per user — the same user always gets the same answer', function (): void {
    AppConfig::factory()->enabled(50)->create(['key' => 'feature.half']);
    $user = User::factory()->create();
    $service = new FeatureFlagService;

    $a = $service->enabled('feature.half', $user);
    $b = $service->enabled('feature.half', $user);
    $c = $service->enabled('feature.half', $user);

    expect($a)->toBe($b)->toBe($c);
});

it('approximates the rollout percentage across many users (50% ± 15%)', function (): void {
    AppConfig::factory()->enabled(50)->create(['key' => 'feature.distribution']);
    $service = new FeatureFlagService;

    $on = 0;
    $total = 200;

    for ($i = 0; $i < $total; $i++) {
        if ($service->enabled('feature.distribution', User::factory()->create())) {
            $on++;
        }
    }

    // SHA-256-based bucket is uniform; this guards against
    // accidental bias introduced by a future refactor.
    expect($on)->toBeGreaterThan(70)->toBeLessThan(130);
});

it('cohort match short-circuits the rollout path', function (): void {
    AppConfig::factory()->create([
        'key' => 'feature.cohort',
        'enabled' => true,
        'rollout_percentage' => 0,
        'cohort' => [['role' => 'moderator']],
    ]);

    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');

    $citizen = User::factory()->create();

    $service = new FeatureFlagService;
    expect($service->enabled('feature.cohort', $moderator))->toBeTrue()
        ->and($service->enabled('feature.cohort', $citizen))->toBeFalse();
});

it('cohort supports array-of-values (in semantics)', function (): void {
    AppConfig::factory()->create([
        'key' => 'feature.anon',
        'enabled' => true,
        'rollout_percentage' => 0,
        'cohort' => [['anonymous_enabled' => [true, false]]],
    ]);

    $u = User::factory()->create();
    expect((new FeatureFlagService)->enabled('feature.anon', $u))->toBeTrue();
});

it('uses the session id for an anonymous caller', function (): void {
    AppConfig::factory()->enabled(50)->create(['key' => 'feature.anon_roll']);
    $service = new FeatureFlagService;

    $a = $service->enabled('feature.anon_roll', null, 'session-abc');
    $b = $service->enabled('feature.anon_roll', null, 'session-abc');

    expect($a)->toBe($b);
});

// --------------------------------------------------------------------------
// HTTP-level evaluation (the /api/v1/admin/app-configs/{key}/evaluate endpoint)
// --------------------------------------------------------------------------

it('evaluates a flag over HTTP for a known user', function (): void {
    Sanctum::actingAs(flagSuperAdmin());
    AppConfig::factory()->enabled(100)->create(['key' => 'feature.http_on']);

    $user = User::factory()->create();
    $this->getJson('/api/v1/admin/app-configs/feature.http_on/evaluate?user_id='.$user->id)
        ->assertStatus(200)
        ->assertJsonPath('data.enabled', true)
        ->assertJsonPath('data.key', 'feature.http_on')
        ->assertJsonPath('data.user_id', $user->id);
});

it('evaluates a flag over HTTP for an anonymous session', function (): void {
    Sanctum::actingAs(flagSuperAdmin());
    AppConfig::factory()->enabled(100)->create(['key' => 'feature.http_anon']);

    $this->getJson('/api/v1/admin/app-configs/feature.http_anon/evaluate?session_id=sess-001')
        ->assertStatus(200)
        ->assertJsonPath('data.enabled', true)
        ->assertJsonPath('data.session_id', 'sess-001');
});

it('returns 404 for an unknown flag on the evaluate endpoint', function (): void {
    Sanctum::actingAs(flagSuperAdmin());

    $this->getJson('/api/v1/admin/app-configs/does.not.exist/evaluate')
        ->assertStatus(404)
        ->assertJsonPath('code', 'NOT_FOUND');
});

it('rejects unauthenticated callers on the evaluate endpoint with 401', function (): void {
    $this->getJson('/api/v1/admin/app-configs/anything/evaluate')
        ->assertStatus(401);
});
