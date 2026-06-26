<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Repositories\WorkflowRepository;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
});

it('super_admin can list workflow definitions', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $response = $this->getJson('/api/v1/admin/workflows');
    $response->assertOk();
    $codes = collect($response->json('data'))->pluck('code')->all();
    expect($codes)->toContain('civic_default');
});

it('non-admin gets 403 on index', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/admin/workflows')->assertStatus(403);
});

it('unauthenticated request is rejected', function (): void {
    $this->getJson('/api/v1/admin/workflows')->assertStatus(401);
});

it('super_admin can read a single workflow with its graph', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $def = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $response = $this->getJson("/api/v1/admin/workflows/{$def->id}");

    $response->assertOk();
    expect($response->json('data.code'))->toBe('civic_default')
        ->and(count($response->json('data.states')))->toBeGreaterThanOrEqual(11)
        ->and(count($response->json('data.transitions')))->toBeGreaterThanOrEqual(13);
});

it('super_admin can create a workflow definition with states and transitions', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $payload = [
        'code' => 'minimal',
        'name' => 'Minimal test workflow',
        'description' => 'Two states, one transition',
        'active' => true,
        'states' => [
            ['code' => 'start', 'name' => 'Start', 'is_initial' => true, 'sort_order' => 10],
            ['code' => 'end',   'name' => 'End',   'is_terminal' => true, 'sort_order' => 20],
        ],
        'transitions' => [
            ['from_state' => 'start', 'to_state' => 'end', 'event' => 'finish', 'sla_minutes' => 60],
        ],
    ];

    $response = $this->postJson('/api/v1/admin/workflows', $payload);
    $response->assertStatus(201);
    expect($response->json('data.code'))->toBe('minimal')
        ->and(count($response->json('data.states')))->toBe(2)
        ->and(count($response->json('data.transitions')))->toBe(1);
});

it('creating a workflow with a duplicate code returns 409', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $payload = [
        'code' => 'civic_default',
        'name' => 'dup',
    ];

    $this->postJson('/api/v1/admin/workflows', $payload)->assertStatus(409);
});

it('non-admin cannot create a workflow', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/admin/workflows', [
        'code' => 'blocked',
        'name' => 'blocked',
    ])->assertStatus(403);
});

it('super_admin can update a workflow name and active flag', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $def = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();

    $response = $this->putJson("/api/v1/admin/workflows/{$def->id}", [
        'name' => 'Renamed civic default',
        'active' => false,
    ]);

    $response->assertOk();
    expect($response->json('data.name'))->toBe('Renamed civic default')
        ->and($response->json('data.active'))->toBeFalse();
});

it('update invalidates the workflow cache so the next read sees the new name', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $def = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();

    // Prime the cache by reading through the repository.
    $cached = app(WorkflowRepository::class)
        ->findActiveByCode('civic_default');
    expect($cached->name)->toBe('Civic Report (default)');

    $this->putJson("/api/v1/admin/workflows/{$def->id}", [
        'name' => 'Cache-busted name',
    ])->assertOk();

    $after = app(WorkflowRepository::class)
        ->findActiveByCode('civic_default');
    expect($after->name)->toBe('Cache-busted name');
});

it('non-admin cannot update a workflow', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $def = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $this->putJson("/api/v1/admin/workflows/{$def->id}", [
        'name' => 'hijack',
    ])->assertStatus(403);
});

it('non-admin cannot delete a workflow', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $def = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $this->deleteJson("/api/v1/admin/workflows/{$def->id}")->assertStatus(403);
});

it('super_admin can delete a workflow that has no reports and is not civic_default', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $payload = [
        'code' => 'deletable',
        'name' => 'Deletable',
        'states' => [
            ['code' => 'a', 'name' => 'A'],
        ],
    ];
    $created = $this->postJson('/api/v1/admin/workflows', $payload);
    $created->assertStatus(201);
    $id = $created->json('data.id');

    $this->deleteJson("/api/v1/admin/workflows/{$id}")->assertOk();
    expect(WorkflowDefinition::query()->withTrashed()->where('id', $id)->first())
        ->not->toBeNull()
        ->and(WorkflowDefinition::query()->where('id', $id)->first())->toBeNull();
});

it('super_admin cannot delete the civic_default workflow', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $def = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $this->deleteJson("/api/v1/admin/workflows/{$def->id}")->assertStatus(409);
});
