<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\NotificationChannelConfig;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function notifConfigSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('rejects the configs list without auth', function (): void {
    $this->getJson('/api/v1/admin/notification-configs')->assertStatus(401);
});

it('rejects a non-admin on the configs list', function (): void {
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/notification-configs')->assertStatus(403);
});

it('lists, creates, updates, and soft-deletes configs with masked credentials', function (): void {
    Sanctum::actingAs(notifConfigSuperAdmin());
    NotificationChannelConfig::factory()->create([
        'channel' => 'mail',
        'code' => 'default',
        'display_name' => 'Default Mail',
    ]);

    $list = $this->getJson('/api/v1/admin/notification-configs');
    $list->assertOk()->assertJsonPath('data.0.code', 'default');
    expect($list->json('data.0.credentials'))->toBeArray();

    $created = $this->postJson('/api/v1/admin/notification-configs', [
        'channel' => 'sms',
        'code' => 'sms-tx',
        'display_name' => 'TX SMS',
        'credentials' => ['api_key' => 'plain-secret', 'host' => 'sms.example.com'],
        'retry_policy' => ['tries' => 3, 'backoff' => [60, 300, 900]],
        'settings' => ['timeout_ms' => 4000],
        'per_locale_defaults' => ['en' => ['from' => 'CIP']],
        'active' => true,
    ]);
    $created->assertCreated()
        ->assertJsonPath('data.channel', 'sms')
        ->assertJsonPath('data.code', 'sms-tx');
    expect($created->json('data.credentials.api_key'))->toBe('********');
    expect($created->json('data.retry_policy.tries'))->toBe(3);

    $id = $created->json('data.id');

    $updated = $this->putJson("/api/v1/admin/notification-configs/{$id}", [
        'display_name' => 'TX SMS v2',
        'active' => false,
    ]);
    $updated->assertOk()
        ->assertJsonPath('data.display_name', 'TX SMS v2')
        ->assertJsonPath('data.active', false);

    $this->deleteJson("/api/v1/admin/notification-configs/{$id}")->assertOk();
    expect(NotificationChannelConfig::find($id))->toBeNull();

    $this->postJson("/api/v1/admin/notification-configs/{$id}/restore")->assertOk();
    expect(NotificationChannelConfig::find($id))->not->toBeNull();
});

it('rejects a duplicate (channel, code) with 409', function (): void {
    Sanctum::actingAs(notifConfigSuperAdmin());
    NotificationChannelConfig::factory()->create([
        'channel' => 'push',
        'code' => 'fcm',
    ]);

    $this->postJson('/api/v1/admin/notification-configs', [
        'channel' => 'push',
        'code' => 'fcm',
        'display_name' => 'FCM',
        'credentials' => ['key' => 'x'],
    ])->assertStatus(409)
        ->assertJsonPath('code', 'DUPLICATE_CODE');
});

it('rejects an unknown channel with 422', function (): void {
    Sanctum::actingAs(notifConfigSuperAdmin());

    $this->postJson('/api/v1/admin/notification-configs', [
        'channel' => 'telegram',
        'code' => 'tg',
        'display_name' => 'TG',
        'credentials' => ['key' => 'x'],
    ])->assertStatus(422);
});

it('filters the list by channel and active', function (): void {
    Sanctum::actingAs(notifConfigSuperAdmin());
    NotificationChannelConfig::factory()->count(2)->create(['channel' => 'sms', 'active' => true]);
    NotificationChannelConfig::factory()->create(['channel' => 'mail', 'active' => false]);

    $r = $this->getJson('/api/v1/admin/notification-configs?channel=sms');
    $r->assertOk()->assertJsonPath('meta.total', 2);

    $r = $this->getJson('/api/v1/admin/notification-configs?active=0');
    $r->assertOk()->assertJsonPath('meta.total', 1);
});
