<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Services\DepartmentService;
use Database\Seeders\DepartmentsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds the four default Bengaluru departments', function (): void {
    (new DepartmentsSeeder(
        app(DepartmentService::class),
    ))->run();

    expect(Department::query()->where('code', 'BBMP')->exists())->toBeTrue()
        ->and(Department::query()->where('code', 'BTP')->exists())->toBeTrue()
        ->and(Department::query()->where('code', 'BWSSB')->exists())->toBeTrue()
        ->and(Department::query()->where('code', 'BESCOM')->exists())->toBeTrue()
        ->and(Department::query()->count())->toBe(4);
});

it('assigns a default_sla_minutes and escalation matrix to every department', function (): void {
    (new DepartmentsSeeder(
        app(DepartmentService::class),
    ))->run();

    Department::query()->each(function (Department $dept): void {
        expect($dept->default_sla_minutes)->toBeGreaterThan(0)
            ->and($dept->escalation_matrix)->toBeArray()
            ->and($dept->escalation_matrix)->not->toBeEmpty();
    });
});

it('is idempotent — a second run does not duplicate rows', function (): void {
    $service = app(DepartmentService::class);
    (new DepartmentsSeeder($service))->run();
    (new DepartmentsSeeder($service))->run();

    expect(Department::query()->count())->toBe(4);
});
