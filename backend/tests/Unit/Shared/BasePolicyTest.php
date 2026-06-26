<?php

declare(strict_types=1);

use App\Modules\Shared\Policies\BasePolicy;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Auth\GenericUser;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Unit coverage for BasePolicy (T-M2-019). Uses a tiny in-test
 * concrete subclass to exercise the `before()` rules in isolation,
 * without any framework-level Gate plumbing.
 */
class TestBasePolicy extends BasePolicy
{
    public function view(Authenticatable $user, mixed $resource): bool
    {
        // Default deny; should never be reached when before() returns
        // a non-null value.
        return false;
    }
}

beforeEach(function (): void {
    $this->policy = new TestBasePolicy;
    (new RolesAndPermissionsSeeder)->run();
});

it('denies unauthenticated access', function (): void {
    $anonymous = new GenericUser(['id' => null]);
    $result = $this->policy->before($anonymous, 'view');

    expect($result)->toBeFalse();
});

it('denies a soft-deleted user', function (): void {
    $user = User::factory()->create();
    $user->delete();

    expect($this->policy->before($user, 'view'))->toBeFalse();
});

it('denies a suspended or disabled user', function (): void {
    foreach (['suspended', 'disabled', 'pending'] as $status) {
        $user = User::factory()->create(['status' => $status]);
        expect($this->policy->before($user, 'view'))->toBeFalse();
    }
});

it('allows a super_admin regardless of the ability', function (): void {
    $user = User::factory()->create();
    $user->assignRole('super_admin');

    expect($this->policy->before($user, 'view'))->toBeTrue();
    expect($this->policy->before($user, 'delete'))->toBeTrue();
});

it('allows the system role', function (): void {
    $user = User::factory()->create();
    $user->assignRole('system');

    expect($this->policy->before($user, 'view'))->toBeTrue();
});

it('defers to the concrete policy method for an active, unprivileged user', function (): void {
    $user = User::factory()->create(['status' => 'active']);
    expect($this->policy->before($user, 'view'))->toBeNull();
});

it('defers to the concrete policy method for a moderator (no bypass)', function (): void {
    $user = User::factory()->create();
    $user->assignRole('moderator');

    expect($this->policy->before($user, 'view'))->toBeNull();
});
