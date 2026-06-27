<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Cache::flush();
    (new RolesAndPermissionsSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
});

it('creates a routing.create audit row on POST', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $dept = Department::factory()->create();
    $priority = ReportPriority::query()->firstOrFail();

    $this->postJson('/api/v1/admin/routing-rules', [
        'name' => 'Test rule',
        'destination_department_id' => $dept->id,
        'default_priority_id' => $priority->id,
        'default_sla_minutes' => 60,
    ])->assertStatus(201);

    $rows = AuditLog::query()->where('entity', 'routing_rules')->where('action', 'routing.create')->get();
    expect($rows)->toHaveCount(1)
        ->and($rows[0]->after)->toBeArray()
        ->and($rows[0]->after['name'])->toBe('Test rule')
        ->and($rows[0]->before)->toBeNull();
});

it('creates a routing.update audit row on PUT', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $rule = RoutingRule::factory()->create(['priority' => 100]);
    $dept = Department::factory()->create();

    $this->putJson("/api/v1/admin/routing-rules/{$rule->id}", [
        'priority' => 5,
        'destination_department_id' => $dept->id,
    ])->assertOk();

    $rows = AuditLog::query()->where('entity', 'routing_rules')->where('action', 'routing.update')->get();
    expect($rows)->toHaveCount(1)
        ->and($rows[0]->before['priority'])->toBe(100)
        ->and($rows[0]->after['priority'])->toBe(5);
});

it('creates a routing.delete audit row on DELETE', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $rule = RoutingRule::factory()->create();
    $this->deleteJson("/api/v1/admin/routing-rules/{$rule->id}")->assertOk();

    $rows = AuditLog::query()->where('entity', 'routing_rules')->where('action', 'routing.delete')->get();
    expect($rows)->toHaveCount(1)
        ->and($rows[0]->entity_id)->toBe($rule->id);
});

it('creates a routing.reorder audit row on POST reorder', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $a = RoutingRule::factory()->create();
    $b = RoutingRule::factory()->create();

    $this->postJson('/api/v1/admin/routing-rules/reorder', [
        'order' => [$b->id, $a->id],
    ])->assertOk();

    $rows = AuditLog::query()->where('entity', 'routing_rules')->where('action', 'routing.reorder')->get();
    expect($rows)->toHaveCount(1)
        ->and($rows[0]->entity_id)->toBeNull()
        ->and($rows[0]->before)->toHaveKey('order')
        ->and($rows[0]->after)->toHaveKey('order');
});

it('records the request_id on every audit row when one is set', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $dept = Department::factory()->create();
    $priority = ReportPriority::query()->firstOrFail();

    $this->postJson('/api/v1/admin/routing-rules', [
        'name' => 'With trace id',
        'destination_department_id' => $dept->id,
        'default_priority_id' => $priority->id,
        'default_sla_minutes' => 60,
    ], ['X-Request-Id' => 'trace-abc-123'])->assertStatus(201);

    $row = AuditLog::query()->where('entity', 'routing_rules')->where('action', 'routing.create')->first();
    expect($row->request_id)->toBe('trace-abc-123');
});

it('writes 5 audit rows for 5 distinct CRUD writes', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $dept = Department::factory()->create();
    $priority = ReportPriority::query()->firstOrFail();

    // 1. create
    $created = $this->postJson('/api/v1/admin/routing-rules', [
        'name' => 'Rule 1',
        'destination_department_id' => $dept->id,
        'default_priority_id' => $priority->id,
        'default_sla_minutes' => 60,
    ])->json('data');

    // 2. update
    $this->putJson("/api/v1/admin/routing-rules/{$created['id']}", [
        'priority' => 5,
    ])->assertOk();

    // 3. create another
    $created2 = $this->postJson('/api/v1/admin/routing-rules', [
        'name' => 'Rule 2',
        'destination_department_id' => $dept->id,
        'default_priority_id' => $priority->id,
        'default_sla_minutes' => 60,
    ])->json('data');

    // 4. delete
    $this->deleteJson("/api/v1/admin/routing-rules/{$created2['id']}")->assertOk();

    // 5. reorder
    $this->postJson('/api/v1/admin/routing-rules/reorder', [
        'order' => [$created['id']],
    ])->assertOk();

    expect(AuditLog::query()->where('entity', 'routing_rules')->whereIn('action', ['routing.create', 'routing.update', 'routing.delete', 'routing.reorder'])->count())->toBe(5);
});
