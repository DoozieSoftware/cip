<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Policies\MediaPolicy;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);



beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

it('view: owner of the parent report can see the media', function (): void {
    $citizen = User::factory()->create();
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    $policy = new MediaPolicy;
    expect($policy->view($citizen, $media))->toBeTrue();
});

it('view: another citizen cannot see the media', function (): void {
    $owner = User::factory()->create();
    $stranger = User::factory()->create();
    $report = Report::factory()->create(['citizen_id' => $owner->id]);
    $media = Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    $policy = new MediaPolicy;
    expect($policy->view($stranger, $media))->toBeFalse();
});

it('view: moderator can see the media', function (): void {
    $citizen = User::factory()->create();
    $mod = User::factory()->create();
    $mod->assignRole('moderator');
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    $policy = new MediaPolicy;
    expect($policy->view($mod, $media))->toBeTrue();
});

it('view: super_admin can see the media (BasePolicy bypass)', function (): void {
    $citizen = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    $policy = new MediaPolicy;
    expect($policy->view($admin, $media))->toBeTrue();
});

it('download: is false for everyone by default (defence in depth)', function (): void {
    $citizen = User::factory()->create();
    $mod = User::factory()->create();
    $mod->assignRole('moderator');
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    $policy = new MediaPolicy;
    expect($policy->download($citizen, $media))->toBeFalse()
        ->and($policy->download($mod, $media))->toBeFalse()
        ->and($policy->download($admin, $media))->toBeFalse();
});

it('update: is always false — evidence is immutable', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $report = Report::factory()->create();
    $media = Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    $policy = new MediaPolicy;
    expect($policy->update($admin, $media))->toBeFalse();
});

it('anonymous request to the list endpoint returns 401 (acceptance)', function (): void {
    $report = Report::factory()->create();

    $this->getJson("/api/v1/reports/{$report->id}/media")
        ->assertStatus(401);
});

it('citizen who is not the owner gets 403 on the list endpoint (acceptance)', function (): void {
    $owner = User::factory()->create();
    $stranger = User::factory()->create();
    Sanctum::actingAs($stranger, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $owner->id]);
    Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    $this->getJson("/api/v1/reports/{$report->id}/media")
        ->assertStatus(403);
});
