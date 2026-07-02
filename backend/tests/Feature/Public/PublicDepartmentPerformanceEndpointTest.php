<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

/**
 * GET /api/v1/public/departments/performance — resolution rate and
 * median resolution time per active department. Only aggregate
 * counts and the department's public name/code — no internal notes,
 * no officer names.
 */
beforeEach(function (): void {
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    Cache::flush();
});

it('requires no authentication', function (): void {
    $this->getJson('/api/v1/public/departments/performance')->assertOk();
});

it('computes resolution rate and omits departments with zero reports', function (): void {
    $dept = Department::factory()->create(['name' => 'BBMP Roads', 'active' => true]);
    $emptyDept = Department::factory()->create(['name' => 'No Reports Dept', 'active' => true]);

    $resolved = ReportStatus::query()->where('code', 'resolved')->firstOrFail();
    $submitted = ReportStatus::query()->where('code', 'submitted')->firstOrFail();

    Report::factory()->create(['department_id' => $dept->id, 'current_status_id' => $resolved->id]);
    Report::factory()->create(['department_id' => $dept->id, 'current_status_id' => $submitted->id]);

    $response = $this->getJson('/api/v1/public/departments/performance');
    $departments = collect($response->json('data.departments'));

    $bbmp = $departments->firstWhere('id', $dept->id);
    expect($bbmp)->not->toBeNull()
        ->and($bbmp['total_reports'])->toBe(2)
        ->and($bbmp['resolved_reports'])->toBe(1)
        // json_encode drops the trailing .0 on a whole-number float.
        ->and($bbmp['resolution_rate_percent'])->toBe(50);

    expect($departments->firstWhere('id', $emptyDept->id))->toBeNull();
});

it('never exposes internal notes or officer names — only name, code, and counts', function (): void {
    $dept = Department::factory()->create(['active' => true]);
    Report::factory()->create(['department_id' => $dept->id]);

    $body = $this->getJson('/api/v1/public/departments/performance')->json('data.departments.0');

    expect(array_keys($body))->toEqualCanonicalizing([
        'id', 'name', 'code', 'total_reports', 'resolved_reports', 'resolution_rate_percent', 'median_resolution_hours',
    ]);
});

it('computes the median resolution time from submitted_at to the first resolved-family transition', function (): void {
    $dept = Department::factory()->create(['active' => true]);
    $resolved = ReportStatus::query()->where('code', 'resolved')->firstOrFail();

    foreach ([10, 20, 30] as $hoursToResolve) {
        $submittedAt = Carbon::now()->subDays(5);
        $report = Report::factory()->create([
            'department_id' => $dept->id,
            'current_status_id' => $resolved->id,
            'submitted_at' => $submittedAt,
        ]);

        ReportStatusHistory::query()->create([
            'report_id' => $report->id,
            'from_status_id' => null,
            'to_status_id' => $resolved->id,
            'created_at' => $submittedAt->copy()->addHours($hoursToResolve),
        ]);
    }

    $body = $this->getJson('/api/v1/public/departments/performance')->json('data.departments.0');

    expect($body['median_resolution_hours'])->toBe(20);
});

it('caches the result for 5 minutes', function (): void {
    $dept = Department::factory()->create(['active' => true]);
    Report::factory()->create(['department_id' => $dept->id]);

    $first = $this->getJson('/api/v1/public/departments/performance')->json('data.departments');

    Report::factory()->count(3)->create(['department_id' => $dept->id]);

    $second = $this->getJson('/api/v1/public/departments/performance')->json('data.departments');

    expect($second)->toEqual($first);
});
