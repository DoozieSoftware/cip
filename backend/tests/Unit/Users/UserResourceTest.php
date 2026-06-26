<?php

declare(strict_types=1);

use App\Modules\Users\Http\Resources\UserResource;
use App\Modules\Users\Models\User;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

beforeEach(function (): void {
    // Clean Spatie's tables so cached roles/permissions don't bleed
    // between tests.
    Role::query()->delete();
    Permission::query()->delete();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
});

it('exposes only safe scalar fields', function (): void {
    $user = User::factory()->create([
        'name' => 'Asha Citizen',
        'email' => 'asha@example.test',
        'mobile' => '9876543210',
        'status' => 'active',
    ]);
    $user->forceFill(['otp_verified_at' => now()])->save();

    $payload = (new UserResource($user))->toArray(request());

    expect($payload)
        ->toHaveKeys([
            'id', 'name', 'mobile', 'email', 'anonymous_enabled',
            'status', 'otp_verified_at', 'last_login_at',
            'created_at',
        ]);

    // Sensitive fields are NEVER in the payload, regardless of whenLoaded.
    expect($payload)
        ->not->toHaveKey('password')
        ->not->toHaveKey('remember_token')
        ->not->toHaveKey('two_factor_secret')
        ->not->toHaveKey('two_factor_recovery_codes');
});

it('omits roles and permissions when the relation is not eager-loaded', function (): void {
    $user = User::factory()->create();

    $payload = (new UserResource($user))->toArray(request());

    // roles/permissions are loaded lazily — absent when not eager-loaded.
    expect($payload)->not->toHaveKey('roles')->not->toHaveKey('permissions');
});

it('includes roles and permissions when the relation is eager-loaded', function (): void {
    $user = User::factory()->create();
    $citizen = Role::create(['name' => 'citizen', 'guard_name' => 'web']);
    $perm = Permission::create(['name' => 'reports.submit', 'guard_name' => 'web']);
    $citizen->givePermissionTo($perm);
    $user->assignRole($citizen);
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $user->unsetRelations();
    $user->load('roles');

    $payload = (new UserResource($user))->toArray(request());

    expect($payload['roles'])->toContain('citizen')
        ->and($payload['permissions'])->toContain('reports.submit');
});

it('returns empty arrays for roles and permissions when the user has none', function (): void {
    $user = User::factory()->create();
    $user->load('roles');

    $payload = (new UserResource($user))->toArray(request());

    expect($payload['roles'])->toBe([])
        ->and($payload['permissions'])->toBe([]);
});

it('serialises timestamps as ISO-8601 strings or null', function (): void {
    $user = User::factory()->create();

    $payload = (new UserResource($user))->toArray(request());

    expect($payload['otp_verified_at'])->toBeNull()
        ->and($payload['last_login_at'])->toBeNull()
        ->and($payload['created_at'])->toBeString();

    // The ISO-8601 string must round-trip via Carbon.
    Carbon::parse($payload['created_at']);
});

it('casts anonymous_enabled to a boolean', function (): void {
    $user = User::factory()->create(['anonymous_enabled' => true]);

    $payload = (new UserResource($user))->toArray(request());

    expect($payload['anonymous_enabled'])->toBeTrue();
});

it('never leaks the password hash even when the model attribute is set', function (): void {
    $user = User::factory()->create();
    $user->forceFill(['password' => 'SomePlaintext'])->save();

    $payload = (new UserResource($user))->toArray(request());

    expect($payload)
        ->not->toHaveKey('password')
        ->not->toHaveKey('password_hash')
        ->not->toHaveKey('two_factor_secret')
        ->not->toHaveKey('two_factor_recovery_codes');
});

it('returns the resource as a JsonResource instance', function (): void {
    $user = User::factory()->create();

    $resource = new UserResource($user);

    expect($resource)->toBeInstanceOf(JsonResource::class);
});
