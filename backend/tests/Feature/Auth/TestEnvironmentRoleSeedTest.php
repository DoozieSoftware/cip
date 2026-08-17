<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

it('boots framework-backed tests with the canonical roles available', function (): void {
    expect(Role::query()->pluck('name')->sort()->values()->all())->toEqual([
        'auditor',
        'citizen',
        'department_admin',
        'department_officer',
        'moderator',
        'super_admin',
        'system',
    ]);
});
