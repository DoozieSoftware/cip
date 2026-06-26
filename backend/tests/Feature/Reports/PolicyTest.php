<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Reports\Policies\LocationPolicy;
use App\Modules\Reports\Policies\ReportPolicy;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

if (! function_exists('makePolicyTester')) {
    function makePolicyTester(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('citizen A cannot view citizen B report', function (): void {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $type = ReportType::factory()->create();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $location = Location::factory()->create();
    $report = Report::query()->create([
        'citizen_id' => $owner->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => $location->id,
        'title' => 'mine',
        'description' => 'mine',
        'is_anonymous' => false,
    ]);

    $policy = app(ReportPolicy::class);

    expect($policy->view($owner, $report))->toBeTrue()
        ->and($policy->view($other, $report))->toBeFalse();
});

it('moderator can view any report', function (): void {
    $owner = User::factory()->create();
    $moderator = makePolicyTester('moderator');
    $type = ReportType::factory()->create();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $location = Location::factory()->create();
    $report = Report::query()->create([
        'citizen_id' => $owner->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => $location->id,
        'title' => 'a',
        'description' => 'a',
    ]);

    $policy = app(ReportPolicy::class);

    expect($policy->view($moderator, $report))->toBeTrue();
});

it('citizen can update only their own draft report', function (): void {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $type = ReportType::factory()->create();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $location = Location::factory()->create();
    $report = Report::query()->create([
        'citizen_id' => $owner->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => $location->id,
        'title' => 'a',
        'description' => 'a',
    ]);

    $policy = app(ReportPolicy::class);

    expect($policy->update($owner, $report))->toBeTrue()    // owner, draft
        ->and($policy->update($other, $report))->toBeFalse(); // not owner, not staff
});

it('only staff can review / assign / delete', function (): void {
    $owner = User::factory()->create();
    $moderator = makePolicyTester('moderator');
    $type = ReportType::factory()->create();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $location = Location::factory()->create();
    $report = Report::query()->create([
        'citizen_id' => $owner->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => $location->id,
        'title' => 'a',
        'description' => 'a',
    ]);

    $policy = app(ReportPolicy::class);

    expect($policy->review($owner, $report))->toBeFalse()
        ->and($policy->review($moderator, $report))->toBeTrue()
        ->and($policy->assign($owner, $report))->toBeFalse()
        ->and($policy->assign($moderator, $report))->toBeTrue()
        ->and($policy->delete($owner, $report))->toBeFalse()
        ->and($policy->delete($moderator, $report))->toBeTrue();
});

it('LocationPolicy follows the owning report ownership', function (): void {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $moderator = makePolicyTester('moderator');
    $type = ReportType::factory()->create();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $location = Location::factory()->create();
    $report = Report::query()->create([
        'citizen_id' => $owner->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => $location->id,
        'title' => 'a',
        'description' => 'a',
    ]);
    $location->refresh();

    $policy = app(LocationPolicy::class);

    expect($policy->view($owner, $location))->toBeTrue()
        ->and($policy->view($other, $location))->toBeFalse()
        ->and($policy->view($moderator, $location))->toBeTrue();
});
