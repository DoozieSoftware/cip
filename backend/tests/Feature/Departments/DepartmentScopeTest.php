<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
});

it('a member of dept A cannot list dept B\'s reports', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $deptB = Department::factory()->create(['code' => 'B']);
    Report::factory()->count(3)->create(['department_id' => $deptB->id]);
    $officer = User::factory()->create();
    $officer->assignRole('department');
    $officer->departments()->attach($deptA->id);
    Sanctum::actingAs($officer);

    $this->getJson('/api/v1/department/reports')
        ->assertOk()
        ->assertJsonPath('meta.total', 0);
});

it('a member of dept A cannot add a note to dept B\'s report (403)', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $deptB = Department::factory()->create(['code' => 'B']);
    $report = Report::factory()->create(['department_id' => $deptB->id]);
    $assigned = \App\Modules\Reports\Models\ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    $report->current_status_id = $assigned->id;
    $report->save();

    $officer = User::factory()->create();
    $officer->assignRole('department');
    $officer->departments()->attach($deptA->id);
    Sanctum::actingAs($officer);

    $this->postJson("/api/v1/department/reports/{$report->id}/note", ['body' => 'leak'])
        ->assertStatus(403);
});

it('a member of dept A cannot accept dept B\'s report (403)', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $deptB = Department::factory()->create(['code' => 'B']);
    $report = Report::factory()->create(['department_id' => $deptB->id]);
    $assigned = \App\Modules\Reports\Models\ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    $report->current_status_id = $assigned->id;
    $report->save();

    $officer = User::factory()->create();
    $officer->assignRole('department');
    $officer->departments()->attach($deptA->id);
    Sanctum::actingAs($officer);

    $this->postJson("/api/v1/department/reports/{$report->id}/accept", [])
        ->assertStatus(403);
});
