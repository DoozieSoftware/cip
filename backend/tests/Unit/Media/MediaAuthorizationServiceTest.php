<?php

declare(strict_types=1);

use App\Modules\Media\Services\MediaAuthorizationService;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

it('returns 404 when report not found', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $service = new MediaAuthorizationService;
    $result = $service->assertCanModifyMedia(request(), '00000000-0000-7000-8000-000000000000');

    expect($result)->not->toBeNull();
    expect($result->getStatusCode())->toBe(404);
});

it('allows report owner to modify media', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $service = new MediaAuthorizationService;
    $result = $service->assertCanModifyMedia(request(), $report->id);

    expect($result)->toBeNull();
});

it('denies non-owner citizen from modifying media', function (): void {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    Sanctum::actingAs($other);
    $report = Report::factory()->create(['citizen_id' => $owner->id]);

    $service = new MediaAuthorizationService;
    $result = $service->assertCanModifyMedia(request(), $report->id);

    expect($result)->not->toBeNull();
    expect($result->getStatusCode())->toBe(403);
});

it('allows staff with department scope to modify media', function (): void {
    $citizen = User::factory()->create();
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $service = new MediaAuthorizationService;
    $result = $service->assertCanModifyMedia(request(), $report->id);

    expect($result)->toBeNull();
});
