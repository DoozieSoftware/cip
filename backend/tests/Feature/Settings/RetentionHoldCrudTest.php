<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Settings\Models\RetentionHold;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function retentionHoldAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('requires a super admin for retention hold management', function (): void {
    $this->getJson('/api/v1/admin/retention-holds')->assertUnauthorized();

    Sanctum::actingAs(User::factory()->create());
    $this->getJson('/api/v1/admin/retention-holds')->assertForbidden();
});

it('creates and lists an active media hold with an audit record', function (): void {
    $admin = retentionHoldAdmin();
    $media = Media::factory()->create();
    Sanctum::actingAs($admin);

    $response = $this->postJson('/api/v1/admin/retention-holds', [
        'entity_type' => 'media',
        'entity_id' => $media->id,
        'reason' => 'Preserve evidence for the legal investigation.',
        'expires_at' => now()->addMonths(6)->toIso8601String(),
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.entity_type', 'media')
        ->assertJsonPath('data.entity_id', $media->id)
        ->assertJsonPath('data.held_by', $admin->id)
        ->assertJsonPath('data.active', true);

    $hold = RetentionHold::query()->firstOrFail();
    expect($hold->entity_type)->toBe(Media::class)
        ->and($hold->held_by)->toBe($admin->id)
        ->and($hold->released_at)->toBeNull();

    expect(AuditLog::query()->where('entity', 'retention_hold')->where('action', 'retention_hold.create')->exists())->toBeTrue();

    $this->getJson('/api/v1/admin/retention-holds?active=1')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.id', $hold->id);
});

it('rejects unsupported targets, expired holds, and duplicate active holds', function (): void {
    $admin = retentionHoldAdmin();
    $media = Media::factory()->create();
    Sanctum::actingAs($admin);

    $this->postJson('/api/v1/admin/retention-holds', [
        'entity_type' => 'report',
        'entity_id' => $media->id,
        'reason' => 'This target type is not in the retention policy.',
    ])->assertUnprocessable()->assertJsonValidationErrors(['entity_type']);

    $this->postJson('/api/v1/admin/retention-holds', [
        'entity_type' => 'media',
        'entity_id' => $media->id,
        'reason' => 'Expiry must be later than the current time.',
        'expires_at' => now()->subMinute()->toIso8601String(),
    ])->assertUnprocessable()->assertJsonPath('errors.expires_at.0', 'The expiry timestamp must be in the future.');

    $payload = [
        'entity_type' => 'media',
        'entity_id' => $media->id,
        'reason' => 'Preserve evidence while the investigation remains open.',
    ];
    $this->postJson('/api/v1/admin/retention-holds', $payload)->assertCreated();
    $this->postJson('/api/v1/admin/retention-holds', $payload)
        ->assertConflict()
        ->assertJsonPath('code', 'RETENTION_HOLD_EXISTS');
});

it('releases a hold with custody fields and prevents a second release', function (): void {
    $admin = retentionHoldAdmin();
    $media = Media::factory()->create();
    $hold = RetentionHold::query()->create([
        'entity_type' => Media::class,
        'entity_id' => $media->id,
        'reason' => 'Preserve evidence while the investigation remains open.',
        'held_by' => $admin->id,
    ]);
    Sanctum::actingAs($admin);

    $this->postJson("/api/v1/admin/retention-holds/{$hold->id}/release", [
        'release_reason' => 'Investigation closed and counsel approved release.',
    ])->assertOk()
        ->assertJsonPath('data.active', false)
        ->assertJsonPath('data.released_by', $admin->id)
        ->assertJsonPath('data.release_reason', 'Investigation closed and counsel approved release.');

    $hold->refresh();
    expect($hold->released_at)->not->toBeNull()
        ->and($hold->released_by)->toBe($admin->id);

    $this->postJson("/api/v1/admin/retention-holds/{$hold->id}/release", [
        'release_reason' => 'This second release must be rejected.',
    ])->assertConflict()->assertJsonPath('code', 'RETENTION_HOLD_RELEASED');
});
