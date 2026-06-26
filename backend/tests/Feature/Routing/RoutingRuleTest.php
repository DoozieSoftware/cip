<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('casts the conditions column to array', function (): void {
    $rule = RoutingRule::factory()->create([
        'conditions' => ['category_in' => ['pothole', 'streetlight']],
    ]);

    $fresh = RoutingRule::query()->find($rule->id);
    expect($fresh->conditions)->toBeArray()
        ->and($fresh->conditions['category_in'])->toContain('pothole');
});

it('casts priority and default_sla_minutes to integers', function (): void {
    $rule = RoutingRule::factory()->create([
        'priority' => '50',
        'default_sla_minutes' => '720',
    ]);

    $fresh = RoutingRule::query()->find($rule->id);
    expect($fresh->priority)->toBe(50)
        ->and($fresh->default_sla_minutes)->toBe(720);
});

it('casts active to boolean', function (): void {
    $rule = RoutingRule::factory()->inactive()->create();
    expect((bool) $rule->fresh()->active)->toBeFalse();

    $active = RoutingRule::factory()->create();
    expect((bool) $active->fresh()->active)->toBeTrue();
});

it('exposes a destinationDepartment relationship that returns a Department', function (): void {
    $dept = Department::factory()->create();
    $rule = RoutingRule::factory()->create([
        'destination_department_id' => $dept->id,
    ]);

    expect($rule->destinationDepartment)->toBeInstanceOf(Department::class)
        ->and($rule->destinationDepartment->id)->toBe($dept->id);
});

it('exposes a defaultOfficer relationship that returns a User when set', function (): void {
    $user = User::factory()->create();
    $rule = RoutingRule::factory()->withOfficer()->create([
        'default_officer_id' => $user->id,
    ]);

    expect($rule->defaultOfficer)->toBeInstanceOf(User::class)
        ->and($rule->defaultOfficer->id)->toBe($user->id);
});

it('exposes a defaultPriority relationship that returns a ReportPriority', function (): void {
    $pri = ReportPriority::factory()->create();
    $rule = RoutingRule::factory()->create([
        'default_priority_id' => $pri->id,
    ]);

    expect($rule->defaultPriority)->toBeInstanceOf(ReportPriority::class)
        ->and($rule->defaultPriority->id)->toBe($pri->id);
});

it('soft-deletes a routing rule and excludes it from default queries', function (): void {
    $rule = RoutingRule::factory()->create();
    $rule->delete();

    expect(RoutingRule::query()->where('id', $rule->id)->exists())->toBeFalse()
        ->and(RoutingRule::withTrashed()->where('id', $rule->id)->exists())->toBeTrue();
});

it('uses a UUID primary key', function (): void {
    $rule = RoutingRule::factory()->create();
    expect($rule->id)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/');
});

it('allows mass-assigning the listed fields', function (): void {
    $dept = Department::factory()->create();
    $pri = ReportPriority::factory()->create();

    $rule = RoutingRule::query()->create([
        'name' => 'mass-assigned',
        'priority' => 75,
        'conditions' => ['keyword_match' => 'pothole'],
        'destination_department_id' => $dept->id,
        'default_officer_id' => null,
        'default_priority_id' => $pri->id,
        'default_sla_minutes' => 360,
        'active' => true,
        'description' => 'unit',
    ]);

    expect($rule->name)->toBe('mass-assigned')
        ->and((int) $rule->priority)->toBe(75)
        ->and($rule->conditions['keyword_match'])->toBe('pothole');
});
