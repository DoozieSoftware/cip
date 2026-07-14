<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
});

it('super_admin can list routing rules', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    RoutingRule::factory()->count(3)->create();

    $response = $this->getJson('/api/v1/admin/routing-rules');
    $response->assertOk();
    expect(count($response->json('data')))->toBe(3);
});

it('returns human-readable options for the routing editor', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $department = Department::factory()->create([
        'name' => 'BBMP Ward 112',
        'code' => 'BBMP-112',
        'active' => true,
    ]);
    $priority = ReportPriority::query()->where('active', true)->firstOrFail();

    $this->getJson('/api/v1/admin/routing-rules/options')
        ->assertOk()
        ->assertJsonFragment([
            'id' => $department->id,
            'name' => 'BBMP Ward 112',
            'code' => 'BBMP-112',
        ])
        ->assertJsonFragment([
            'id' => $priority->id,
            'name' => $priority->name,
            'code' => $priority->code,
        ]);
});

it('non-admin gets 403 on index', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/admin/routing-rules')->assertStatus(403);
});

it('unauthenticated request is rejected', function (): void {
    $this->getJson('/api/v1/admin/routing-rules')->assertStatus(401);
});

it('super_admin can read a single routing rule', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $rule = RoutingRule::factory()->create();
    $response = $this->getJson("/api/v1/admin/routing-rules/{$rule->id}");

    $response->assertOk();
    expect($response->json('data.id'))->toBe($rule->id)
        ->and($response->json('data.name'))->toBe($rule->name)
        ->and($response->json('data.priority'))->toBe((int) $rule->priority);
});

it('super_admin can create a routing rule', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $dept = Department::factory()->create();
    $priority = ReportPriority::query()->firstOrFail();

    $payload = [
        'name' => 'Pothole -> BBMP Ward 112',
        'description' => 'Garbage and pothole reports',
        'priority' => 10,
        'conditions' => ['category_in' => ['pothole']],
        'destination_department_id' => $dept->id,
        'default_priority_id' => $priority->id,
        'default_sla_minutes' => 240,
        'active' => true,
    ];

    $response = $this->postJson('/api/v1/admin/routing-rules', $payload);
    $response->assertStatus(201);

    expect($response->json('data.name'))->toBe('Pothole -> BBMP Ward 112')
        ->and($response->json('data.priority'))->toBe(10)
        ->and($response->json('data.conditions'))->toBe(['category_in' => ['pothole']]);

    $this->assertDatabaseHas('routing_rules', ['name' => 'Pothole -> BBMP Ward 112']);
});

it('create rejects an unknown department with VALIDATION_FAILED', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $priority = ReportPriority::query()->firstOrFail();
    $payload = [
        'name' => 'Bad rule',
        'destination_department_id' => (string) Str::uuid(),
        'default_priority_id' => $priority->id,
        'default_sla_minutes' => 60,
    ];

    $this->postJson('/api/v1/admin/routing-rules', $payload)
        ->assertStatus(422)
        ->assertJsonPath('code', 'VALIDATION_FAILED');
});

it('super_admin can update a routing rule', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $rule = RoutingRule::factory()->create(['priority' => 100]);
    $dept = Department::factory()->create();

    $response = $this->putJson("/api/v1/admin/routing-rules/{$rule->id}", [
        'priority' => 5,
        'destination_department_id' => $dept->id,
        'active' => false,
    ]);

    $response->assertOk();
    expect($response->json('data.priority'))->toBe(5)
        ->and($response->json('data.active'))->toBeFalse();

    $this->assertDatabaseHas('routing_rules', ['id' => $rule->id, 'priority' => 5, 'active' => false]);
});

it('super_admin can soft-delete a routing rule', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $rule = RoutingRule::factory()->create();
    $this->deleteJson("/api/v1/admin/routing-rules/{$rule->id}")->assertOk();

    $this->assertSoftDeleted('routing_rules', ['id' => $rule->id]);
});

it('reorder assigns priorities in 10-step increments and persists the new order', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $a = RoutingRule::factory()->create(['priority' => 1]);
    $b = RoutingRule::factory()->create(['priority' => 2]);
    $c = RoutingRule::factory()->create(['priority' => 3]);

    $response = $this->postJson('/api/v1/admin/routing-rules/reorder', [
        'order' => [$c->id, $a->id, $b->id],
    ]);

    $response->assertOk();

    $this->assertDatabaseHas('routing_rules', ['id' => $c->id, 'priority' => 10]);
    $this->assertDatabaseHas('routing_rules', ['id' => $a->id, 'priority' => 20]);
    $this->assertDatabaseHas('routing_rules', ['id' => $b->id, 'priority' => 30]);
});

it('reorder with an unknown rule id returns 404', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $this->postJson('/api/v1/admin/routing-rules/reorder', [
        'order' => [(string) Str::uuid()],
    ])->assertStatus(404);
});
