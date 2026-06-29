<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(Tests\TestCase::class)->in('Feature');

/*
|--------------------------------------------------------------------------
| Shared M11 helpers
|--------------------------------------------------------------------------
*/

if (! function_exists('seedCivicRolesAndStatuses')) {
    function seedCivicRolesAndStatuses(): void
    {
        if (Role::query()->where('name', 'citizen')->doesntExist()) {
            (new RolesAndPermissionsSeeder)->run();
        }
        if (ReportStatus::query()->count() === 0) {
            (new ReportStatusesSeeder)->run();
            (new DefaultWorkflowSeeder)->run();
        }
    }
}

if (! function_exists('makeDepartmentOfficer')) {
    function makeDepartmentOfficer(Department $dept): User
    {
        Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
        $u = User::factory()->create();
        $u->assignRole('department');
        $u->departments()->attach($dept->id);
        return $u;
    }
}

if (! function_exists('landReportInAssigned')) {
    function landReportInAssigned(Department $dept): Report
    {
        $workflow = \App\Modules\Workflow\Models\WorkflowDefinition::query()
            ->where('code', 'civic_default')
            ->firstOrFail();
        $report = Report::factory()->create([
            'department_id' => $dept->id,
            'workflow_id' => $workflow->id,
        ]);
        $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
        $report->current_status_id = $assigned->id;
        $report->save();
        return $report->refresh();
    }
}
