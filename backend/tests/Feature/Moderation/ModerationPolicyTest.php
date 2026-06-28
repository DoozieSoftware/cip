<?php

declare(strict_types=1);

use App\Modules\Moderation\Policies\ModerationPolicy;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;

uses(RefreshDatabase::class);

/**
 * Per docs/07 §3 the moderation surface is gated by the
 * `moderator` role. Citizens (the platform's default user
 * type) must NOT be able to view the queue or apply decisions.
 * super_admin and system inherit the bypass from BasePolicy.
 *
 * The tests go through the Gate facade so the BasePolicy::before()
 * hook fires (direct method calls bypass `before`).
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    // Register the ModerationPolicy with the Gate so the abilities
    // map to the policy class.
    Gate::policy(Report::class, ModerationPolicy::class);

    // The `viewQueue` and `viewAnalytics` abilities do not take a
    // Report model, so they are not auto-routed. Register them
    // explicitly against the policy.
    Gate::define('viewQueue', [ModerationPolicy::class, 'viewQueue']);
    Gate::define('viewAnalytics', [ModerationPolicy::class, 'viewAnalytics']);
});

function makeReport(): Report
{
    return Report::factory()->create();
}

it('a citizen cannot view the moderation queue', function (): void {
    $citizen = User::factory()->create();
    $report = makeReport();

    expect(Gate::forUser($citizen)->allows('viewQueue'))->toBeFalse()
        ->and(Gate::forUser($citizen)->allows('viewReport', $report))->toBeFalse();
});

it('a citizen cannot apply the four moderation decisions', function (): void {
    $citizen = User::factory()->create();
    $report = makeReport();

    expect(Gate::forUser($citizen)->allows('review', $report))->toBeFalse()
        ->and(Gate::forUser($citizen)->allows('merge', $report))->toBeFalse()
        ->and(Gate::forUser($citizen)->allows('reject', $report))->toBeFalse()
        ->and(Gate::forUser($citizen)->allows('escalate', $report))->toBeFalse()
        ->and(Gate::forUser($citizen)->allows('reassign', $report))->toBeFalse();
});

it('a citizen cannot view the moderator analytics', function (): void {
    $citizen = User::factory()->create();
    expect(Gate::forUser($citizen)->allows('viewAnalytics'))->toBeFalse();
});

it('a moderator can view the queue and report detail', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    $report = makeReport();

    expect(Gate::forUser($moderator)->allows('viewQueue'))->toBeTrue()
        ->and(Gate::forUser($moderator)->allows('viewReport', $report))->toBeTrue();
});

it('a moderator can apply all four decisions', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    $report = makeReport();

    expect(Gate::forUser($moderator)->allows('review', $report))->toBeTrue()
        ->and(Gate::forUser($moderator)->allows('merge', $report))->toBeTrue()
        ->and(Gate::forUser($moderator)->allows('reject', $report))->toBeTrue()
        ->and(Gate::forUser($moderator)->allows('escalate', $report))->toBeTrue()
        ->and(Gate::forUser($moderator)->allows('reassign', $report))->toBeTrue();
});

it('a moderator can view the analytics dashboard', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');

    expect(Gate::forUser($moderator)->allows('viewAnalytics'))->toBeTrue();
});

it('a super admin inherits the bypass and is allowed on every ability', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $report = makeReport();

    expect(Gate::forUser($admin)->allows('viewQueue'))->toBeTrue()
        ->and(Gate::forUser($admin)->allows('viewReport', $report))->toBeTrue()
        ->and(Gate::forUser($admin)->allows('review', $report))->toBeTrue()
        ->and(Gate::forUser($admin)->allows('merge', $report))->toBeTrue()
        ->and(Gate::forUser($admin)->allows('reject', $report))->toBeTrue()
        ->and(Gate::forUser($admin)->allows('escalate', $report))->toBeTrue()
        ->and(Gate::forUser($admin)->allows('reassign', $report))->toBeTrue()
        ->and(Gate::forUser($admin)->allows('viewAnalytics'))->toBeTrue();
});

it('a department officer is NOT a moderator by default', function (): void {
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $report = makeReport();

    expect(Gate::forUser($officer)->allows('viewQueue'))->toBeFalse()
        ->and(Gate::forUser($officer)->allows('review', $report))->toBeFalse();
});

it('a suspended moderator is denied regardless of role', function (): void {
    $moderator = User::factory()->create(['status' => 'suspended']);
    $moderator->assignRole('moderator');

    // BasePolicy::before() denies suspended users before any
    // per-ability check — so even the moderator role cannot
    // get past the gate.
    expect(Gate::forUser($moderator)->allows('viewQueue'))->toBeFalse();
});

it('a soft-deleted moderator is denied regardless of role', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    $moderator->delete(); // soft delete
    $moderator->refresh();

    expect(Gate::forUser($moderator)->allows('viewQueue'))->toBeFalse();
});
