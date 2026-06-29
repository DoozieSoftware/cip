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
    $this->user = User::factory()->create();
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

function makeNotification(User $user): Notification
{
    $n = new Notification([
        'user_id' => $user->id,
        'type' => 'report.assigned',
        'channel' => 'email',
        'payload' => ['rendered' => ['subject' => 'Hi', 'body' => 'Body']],
        'status' => Notification::STATUS_SENT,
        'retry_count' => 0,
    ]);
    $n->id = (string) Str::uuid();
    $n->save();

    return $n;
}

it('marks a notification as read for the authenticated user', function (): void {
    $n = makeNotification($this->user);

    $response = $this->postJson("/api/v1/notifications/{$n->id}/read");

    $response->assertOk();
    expect($response->json('data.id'))->toBe($n->id)
        ->and($response->json('data.read_at'))->not->toBeNull();

    expect($n->fresh()->read_at)->not->toBeNull();
});

it('is idempotent: marking an already-read notification returns 200 without changing read_at', function (): void {
    $n = makeNotification($this->user);
    $n->read_at = now()->subHour();
    $n->save();
    $original = $n->read_at->toIso8601String();

    $response = $this->postJson("/api/v1/notifications/{$n->id}/read");

    $response->assertOk();
    expect($n->fresh()->read_at->toIso8601String())->toBe($original);
});

it('returns 404 when the notification belongs to another user', function (): void {
    $other = User::factory()->create();
    $n = makeNotification($other);

    $response = $this->postJson("/api/v1/notifications/{$n->id}/read");

    $response->assertStatus(404);
});

it('returns 404 when the notification does not exist', function (): void {
    $response = $this->postJson('/api/v1/notifications/'.Str::uuid().'/read');

    $response->assertStatus(404);
});

it('returns 401 when the caller is not authenticated', function (): void {
    auth()->forgetGuards();
    $n = makeNotification($this->user);

    $response = $this->postJson("/api/v1/notifications/{$n->id}/read");

    $response->assertStatus(401);
});
