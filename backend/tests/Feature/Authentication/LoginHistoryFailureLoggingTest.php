<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;

uses(RefreshDatabase::class);

/**
 * A failed login_history write must never break the auth flow, but it
 * also must not vanish silently — a dropped row blinds the failed-attempt
 * lockout and security review, so it has to reach the logs.
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

afterEach(function (): void {
    // Remove the throwing `creating` hook and reset the booted state so
    // HasUuids re-registers cleanly for later tests in this process.
    LoginHistory::flushEventListeners();
    LoginHistory::clearBootedModels();
});

it('logs a warning when a login_history write fails but still returns 401', function (): void {
    $staff = User::factory()->moderator()->create();

    Log::spy();
    LoginHistory::creating(function (): void {
        throw new RuntimeException('simulated write failure');
    });

    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(401)->assertJsonPath('code', 'UNAUTHORIZED');

    Log::shouldHaveReceived('warning')
        ->withArgs(fn (string $message): bool => $message === 'login_history.write_failed')
        ->atLeast()->once();
});
