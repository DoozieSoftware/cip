<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\Notification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Users\Models\User;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);


beforeEach(function (): void {
    $this->user = User::factory()->create(['email' => 'citizen@example.test']);
    Sanctum::actingAs($this->user);

    NotificationTemplate::query()->delete();
    $tpl = new NotificationTemplate([
        'code' => 'report.assigned',
        'name' => 'Report Assigned',
        'channel' => 'email',
        'subject' => 'Hi',
        'body' => 'Body for {tracking_number}',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $tpl->id = (string) Str::uuid();
    $tpl->save();
});

function makeInboxNotification(User $user, string $type, bool $read = false): Notification
{
    $n = new Notification([
        'user_id' => $user->id,
        'type' => $type,
        'channel' => 'email',
        'payload' => [
            'rendered' => ['subject' => 'Hi', 'body' => 'Body'],
            'variables' => ['tracking_number' => 'CIV-2026-000001'],
        ],
        'status' => Notification::STATUS_SENT,
        'retry_count' => 0,
    ]);
    $n->id = (string) Str::uuid();

    if ($read) {
        $n->read_at = now();
    }
    $n->save();

    return $n;
}

it('returns only the authenticated user notifications', function (): void {
    $stranger = User::factory()->create();
    makeInboxNotification($this->user, 'report.assigned');
    makeInboxNotification($this->user, 'report.assigned');
    makeInboxNotification($stranger, 'report.assigned');

    $response = $this->getJson('/api/v1/notifications');

    $response->assertOk();
    $body = $response->json('data');
    expect($body['items'])->toHaveCount(2)
        ->and($body['unread_count'])->toBe(2);
});

it('filters by type when ?type= is supplied', function (): void {
    makeInboxNotification($this->user, 'report.assigned');
    makeInboxNotification($this->user, 'report.status_changed');
    makeInboxNotification($this->user, 'report.assigned');

    $response = $this->getJson('/api/v1/notifications?type=report.assigned');

    $response->assertOk();
    expect($response->json('data.items'))->toHaveCount(2);
});

it('filters to unread when ?unread=1', function (): void {
    makeInboxNotification($this->user, 'report.assigned', read: false);
    makeInboxNotification($this->user, 'report.assigned', read: true);
    makeInboxNotification($this->user, 'report.assigned', read: false);

    $response = $this->getJson('/api/v1/notifications?unread=1');

    $response->assertOk();
    expect($response->json('data.items'))->toHaveCount(2)
        ->and($response->json('data.unread_count'))->toBe(2);
});

it('returns 401 when not authenticated', function (): void {
    // Forget the acting-as user.
    auth()->forgetGuards();

    $response = $this->getJson('/api/v1/notifications');

    $response->assertStatus(401);
});

it('shapes the response with id, type, channel, subject, body, status, read_at, created_at', function (): void {
    $n = makeInboxNotification($this->user, 'report.assigned');

    $response = $this->getJson('/api/v1/notifications');

    $response->assertOk();
    $item = $response->json('data.items.0');
    expect($item)->toHaveKeys(['id', 'type', 'channel', 'subject', 'body', 'status', 'read_at', 'created_at', 'metadata'])
        ->and($item['id'])->toBe($n->id)
        ->and($item['type'])->toBe('report.assigned')
        ->and($item['channel'])->toBe('email')
        ->and($item['metadata']['tracking_number'])->toBe('CIV-2026-000001');
});

it('caps the per_page at 100 and defaults to 20', function (): void {
    for ($i = 0; $i < 25; $i++) {
        makeInboxNotification($this->user, 'report.assigned');
    }

    $response = $this->getJson('/api/v1/notifications?per_page=200');
    $response->assertOk();
    expect(count($response->json('data.items')))->toBeLessThanOrEqual(100);

    $default = $this->getJson('/api/v1/notifications');
    expect(count($default->json('data.items')))->toBeLessThanOrEqual(20);
});
