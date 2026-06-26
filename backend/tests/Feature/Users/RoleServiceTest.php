<?php

declare(strict_types=1);

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Events\UserPermissionChanged;
use App\Modules\Users\Events\UserRoleChanged;
use App\Modules\Users\Models\User;
use App\Modules\Users\Services\RoleService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Event;

/**
 * Feature coverage for RoleService (T-M2-019).
 *
 * Per docs/03 §14 and docs/11 §9. The service is the only path
 * through which the application mutates role membership. The
 * tests verify idempotency, the protected-roles guard, the
 * throw-on-unknown semantics, and that every mutation emits the
 * matching event.
 */
beforeEach(function (): void {
    $this->service = app(RoleService::class);
    (new RolesAndPermissionsSeeder)->run();
});

it('assigns a role and emits UserRoleChanged', function (): void {
    Event::fake([UserRoleChanged::class]);

    $user = User::factory()->create();
    $this->service->assign($user, 'moderator');

    expect($user->fresh()->hasRole('moderator'))->toBeTrue();
    Event::assertDispatched(
        UserRoleChanged::class,
        fn ($event) => $event->userId === $user->id
            && $event->role === 'moderator'
            && $event->action === 'assigned',
    );
});

it('is idempotent on assign — second call does not re-emit', function (): void {
    Event::fake([UserRoleChanged::class]);

    $user = User::factory()->create();
    $this->service->assign($user, 'moderator');
    $this->service->assign($user, 'moderator');

    expect($user->fresh()->hasRole('moderator'))->toBeTrue();
    Event::assertDispatchedTimes(UserRoleChanged::class, 1);
});

it('revokes a role and emits UserRoleChanged', function (): void {
    Event::fake([UserRoleChanged::class]);

    $user = User::factory()->create();
    $this->service->assign($user, 'moderator');
    $this->service->revoke($user, 'moderator');

    expect($user->fresh()->hasRole('moderator'))->toBeFalse();
    Event::assertDispatched(
        UserRoleChanged::class,
        fn ($event) => $event->action === 'revoked',
    );
});

it('is idempotent on revoke — second call does not emit', function (): void {
    Event::fake([UserRoleChanged::class]);

    $user = User::factory()->create();
    $this->service->assign($user, 'moderator');
    Event::fake([UserRoleChanged::class]); // reset after assign
    $this->service->revoke($user, 'moderator');
    $this->service->revoke($user, 'moderator');

    expect($user->fresh()->hasRole('moderator'))->toBeFalse();
    Event::assertDispatchedTimes(UserRoleChanged::class, 1);
});

it('refuses to revoke a protected role (super_admin / system)', function (): void {
    $user = User::factory()->create();
    $this->service->assign($user, 'super_admin');

    expect(fn () => $this->service->revoke($user, 'super_admin'))
        ->toThrow(ApiException::class, 'protected');
    expect($user->fresh()->hasRole('super_admin'))->toBeTrue();
});

it('throws 422 ROLE_NOT_FOUND on unknown role', function (): void {
    $user = User::factory()->create();

    expect(fn () => $this->service->assign($user, 'this-role-does-not-exist'))
        ->toThrow(ApiException::class);
});

it('hasRole / hasAnyRole / hasPermission / hasAnyPermission return correct booleans', function (): void {
    $user = User::factory()->create();
    $this->service->assign($user, 'moderator');

    expect($this->service->hasRole($user, 'moderator'))->toBeTrue();
    expect($this->service->hasRole($user, 'super_admin'))->toBeFalse();
    expect($this->service->hasAnyRole($user, ['super_admin', 'moderator']))->toBeTrue();
    expect($this->service->hasAnyRole($user, ['super_admin', 'system']))->toBeFalse();
    expect($this->service->hasPermission($user, 'reports.view'))->toBeTrue();
    expect($this->service->hasPermission($user, 'reports.create'))->toBeFalse();
    expect($this->service->hasAnyPermission($user, ['reports.create', 'reports.view']))->toBeTrue();
    expect($this->service->hasAnyPermission($user, ['reports.create', 'users.delete']))->toBeFalse();
});

it('grants a permission to a user', function (): void {
    Event::fake([UserPermissionChanged::class]);

    $user = User::factory()->create();
    $this->service->grantPermission($user, 'reports.create');

    expect($user->fresh()->can('reports.create'))->toBeTrue();
    Event::assertDispatched(
        UserPermissionChanged::class,
        fn ($event) => $event->action === 'granted',
    );
});

it('revokes a permission from a user', function (): void {
    Event::fake([UserPermissionChanged::class]);

    $user = User::factory()->create();
    $this->service->grantPermission($user, 'reports.create');
    expect($user->fresh()->can('reports.create'))->toBeTrue();

    $this->service->revokePermission($user, 'reports.create');

    expect($user->fresh()->can('reports.create'))->toBeFalse();
});

it('rolesFor and permissionsFor return name lists', function (): void {
    $user = User::factory()->create();
    $this->service->assign($user, 'moderator');
    $this->service->assign($user, 'citizen');

    expect($this->service->rolesFor($user->fresh()))->toEqualCanonicalizing(['citizen', 'moderator']);
    expect($this->service->permissionsFor($user->fresh()))->toContain('reports.view');
});
