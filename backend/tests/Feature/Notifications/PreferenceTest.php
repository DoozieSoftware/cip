<?php

declare(strict_types=1);

use App\Modules\Notifications\Jobs\SendNotificationJob;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Notifications\Services\NotificationPreferenceService;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->user = User::factory()->create(['email' => 'citizen@example.test']);
    Sanctum::actingAs($this->user);

    NotificationTemplate::query()->delete();
    $tpl = new NotificationTemplate([
        'code' => 'report.assigned',
        'name' => 'Report Assigned',
        'channel' => 'email',
        'subject' => 'Hi',
        'body' => 'Body',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $tpl->id = (string) Str::uuid();
    $tpl->save();
});

it('GET /api/v1/notifications/preferences returns an empty list initially', function (): void {
    $response = $this->getJson('/api/v1/notifications/preferences');

    $response->assertOk();
    expect($response->json('data.preferences'))->toBe([]);
});

it('PUT /api/v1/notifications/preferences persists a preference', function (): void {
    $response = $this->putJson('/api/v1/notifications/preferences', [
        'preferences' => [
            ['channel' => 'email', 'event_code' => 'report.assigned', 'enabled' => false],
        ],
    ]);

    $response->assertOk();
    expect(NotificationPreference::query()->where('user_id', $this->user->id)->count())->toBe(1);

    $row = NotificationPreference::query()->where('user_id', $this->user->id)->first();
    expect($row->enabled)->toBeFalse();
});

it('validates the channel against the enum', function (): void {
    $response = $this->putJson('/api/v1/notifications/preferences', [
        'preferences' => [
            ['channel' => 'carrier-pigeon', 'event_code' => 'x', 'enabled' => true],
        ],
    ]);

    $response->assertStatus(422);
});

it('validates the boolean `enabled` field', function (): void {
    $response = $this->putJson('/api/v1/notifications/preferences', [
        'preferences' => [
            ['channel' => 'email', 'event_code' => 'x', 'enabled' => 'maybe'],
        ],
    ]);

    $response->assertStatus(422);
});

it('upserts existing preferences idempotently', function (): void {
    $this->putJson('/api/v1/notifications/preferences', [
        'preferences' => [
            ['channel' => 'email', 'event_code' => 'report.assigned', 'enabled' => true],
        ],
    ]);
    $this->putJson('/api/v1/notifications/preferences', [
        'preferences' => [
            ['channel' => 'email', 'event_code' => 'report.assigned', 'enabled' => false],
        ],
    ]);

    expect(NotificationPreference::query()->where('user_id', $this->user->id)->count())->toBe(1)
        ->and(NotificationPreference::query()->where('user_id', $this->user->id)->first()->enabled)->toBeFalse();
});

it('suppresses a notification when the user has opted out', function (): void {
    Bus::fake([SendNotificationJob::class]);

    app(NotificationPreferenceService::class)->setEnabled(
        $this->user,
        'email',
        'report.assigned',
        false,
    );

    $dispatcher = app(NotificationDispatcher::class);
    $result = $dispatcher->dispatch($this->user, 'report.assigned', []);

    expect($result->status)->toBe(Notification::STATUS_DEAD)
        ->and($result->payload['reason'])->toBe('opted_out');

    Bus::assertNotDispatched(SendNotificationJob::class);
});

it('dispatches normally when the preference is enabled', function (): void {
    Bus::fake([SendNotificationJob::class]);

    app(NotificationPreferenceService::class)->setEnabled(
        $this->user,
        'email',
        'report.assigned',
        true,
    );

    $dispatcher = app(NotificationDispatcher::class);
    $result = $dispatcher->dispatch($this->user, 'report.assigned', []);

    expect($result->status)->toBe(Notification::STATUS_PENDING);
    Bus::assertDispatched(SendNotificationJob::class);
});

it('returns 401 when not authenticated', function (): void {
    auth()->forgetGuards();

    $this->getJson('/api/v1/notifications/preferences')->assertStatus(401);
    $this->putJson('/api/v1/notifications/preferences', ['preferences' => []])->assertStatus(401);
});
