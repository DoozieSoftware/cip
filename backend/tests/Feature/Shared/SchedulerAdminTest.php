<?php

declare(strict_types=1);

use App\Modules\Settings\Models\Setting;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function schedulerSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('rejects the scheduler list without auth', function (): void {
    $this->getJson('/api/v1/admin/scheduler/jobs')->assertStatus(401);
});

it('rejects a non-admin on the scheduler list', function (): void {
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/scheduler/jobs')->assertStatus(403);
});

it('lists the registered jobs', function (): void {
    Sanctum::actingAs(schedulerSuperAdmin());

    $r = $this->getJson('/api/v1/admin/scheduler/jobs');
    $r->assertOk();

    $jobs = $r->json('data');
    expect($jobs)->toBeArray();
    expect(collect($jobs)->pluck('id'))->toContain('workflow:check-sla-breaches');
});

it('pauses and resumes a job', function (): void {
    Sanctum::actingAs(schedulerSuperAdmin());
    $name = 'workflow:check-sla-breaches';

    $pause = $this->postJson("/api/v1/admin/scheduler/jobs/{$name}/pause");
    $pause->assertOk()->assertJsonPath('data.paused', true);

    $list = $this->getJson('/api/v1/admin/scheduler/jobs');
    $hit = collect($list->json('data'))->firstWhere('id', $name);
    expect($hit['paused'])->toBeTrue();

    $stored = Setting::query()->where('key', 'scheduler_paused_jobs')->first();
    expect($stored->value)->toContain($name);

    $resume = $this->postJson("/api/v1/admin/scheduler/jobs/{$name}/resume");
    $resume->assertOk()->assertJsonPath('data.paused', false);

    $list = $this->getJson('/api/v1/admin/scheduler/jobs');
    $hit = collect($list->json('data'))->firstWhere('id', $name);
    expect($hit['paused'])->toBeFalse();
});

it('runs-now for an unknown job returns a safe result', function (): void {
    Sanctum::actingAs(schedulerSuperAdmin());

    $r = $this->postJson('/api/v1/admin/scheduler/jobs/nope/run-now');
    $r->assertOk()->assertJsonPath('data.job', 'nope');
    expect($r->json('data.result'))->toContain('no matching event');
});
