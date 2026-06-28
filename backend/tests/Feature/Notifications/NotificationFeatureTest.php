<?php

declare(strict_types=1);

use App\Modules\Notifications\Jobs\SendNotificationJob;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationLog;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Notifications\Services\NotificationPreferenceService;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use Database\Seeders\NotificationTemplatesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new NotificationTemplatesSeeder)->run();

    $this->user = User::factory()->create(['email' => 'citizen@example.test']);
    $this->dispatcher = app(NotificationDispatcher::class);
    $this->preferences = app(NotificationPreferenceService::class);

    Mail::fake();
    Bus::fake([SendNotificationJob::class]);
});

it('happy path: dispatcher creates a pending row, queues the job, and SendNotificationJob marks it sent + writes a log', function (): void {
    $n = $this->dispatcher->dispatch($this->user, 'report.assigned', [
        'name' => 'Anu',
        'tracking_number' => 'CIV-2026-000001',
        'title' => 'Pothole on 5th Ave',
        'department' => 'BBMP',
        'city' => 'Bengaluru',
    ]);

    expect($n->status)->toBe(Notification::STATUS_PENDING)
        ->and($n->payload['rendered']['body'])->toContain('Anu')
        ->and($n->payload['rendered']['body'])->toContain('BBMP');

    Bus::assertDispatched(SendNotificationJob::class, fn ($job) => $job->notificationId === $n->id);

    // Drive the job synchronously.
    (new SendNotificationJob($n->id))->handle();

    $fresh = $n->fresh();
    expect($fresh->status)->toBe(Notification::STATUS_SENT)
        ->and(NotificationLog::query()->where('notification_id', $n->id)->count())->toBe(1);
});

it('dead-letter path: 5 transient failures mark the row dead and write an audit_logs entry', function (): void {
    // Force a transient failure by stubbing the email channel to throw.
    Mail::shouldReceive('to')->andThrow(new RuntimeException('smtp 503 backend overload'));

    $n = $this->dispatcher->dispatch($this->user, 'report.assigned', [
        'name' => 'Anu',
        'tracking_number' => 'CIV-2026-000001',
        'title' => 'Pothole on 5th Ave',
        'department' => 'BBMP',
        'city' => 'Bengaluru',
    ]);

    $job = new SendNotificationJob($n->id);

    // Simulate 5 failed attempts by forcing retry_count to the cap.
    $n->retry_count = $job->tries;
    $n->save();

    $job->handle();

    $fresh = $n->fresh();
    expect($fresh->status)->toBe(Notification::STATUS_DEAD);

    $audit = AuditLog::query()->where('action', 'notification.dead_letter')->first();
    expect($audit)->not->toBeNull()
        ->and($audit->entity_id)->toBe($n->id);
});

it('preference suppression: opted-out events do not queue a SendNotificationJob', function (): void {
    $this->preferences->setEnabled($this->user, 'email', 'report.assigned', false);

    $n = $this->dispatcher->dispatch($this->user, 'report.assigned', [
        'name' => 'Anu',
        'tracking_number' => 'CIV-2026-000001',
        'title' => 'Pothole on 5th Ave',
        'department' => 'BBMP',
        'city' => 'Bengaluru',
    ]);

    expect($n->status)->toBe(Notification::STATUS_DEAD)
        ->and($n->payload['reason'])->toBe('opted_out');

    Bus::assertNotDispatched(SendNotificationJob::class);
});

it('webhook channel renders JSON body for ai.completed', function (): void {
    // The webhook template body is a JSON string. The
    // dispatcher renders the placeholders and the rendered
    // body becomes valid JSON.
    $n = $this->dispatcher->dispatch($this->user, 'ai.completed', [
        'report_id' => (string) Str::uuid(),
        'ai_label' => 'road.pothole',
        'category' => 'pothole',
        'severity' => 'medium',
        'confidence' => 0.97,
    ], null, ['channel' => 'webhook']);

    expect($n->channel)->toBe('webhook')
        ->and($n->payload['rendered']['body'])->toContain('"ai_label":"road.pothole"')
        ->and($n->payload['rendered']['body'])->toContain('"confidence":0.97');
});

it('reports endpoint: 200 returns only the caller\'s notifications, paginated', function (): void {
    Sanctum::actingAs($this->user);

    for ($i = 0; $i < 5; $i++) {
        $n = new Notification([
            'user_id' => $this->user->id,
            'type' => 'report.assigned',
            'channel' => 'email',
            'payload' => ['rendered' => ['subject' => 's', 'body' => 'b']],
            'status' => Notification::STATUS_SENT,
            'retry_count' => 0,
        ]);
        $n->id = (string) Str::uuid();
        $n->save();
    }

    $response = $this->getJson('/api/v1/notifications');
    $response->assertOk();
    expect(count($response->json('data.items')))->toBe(5)
        ->and($response->json('data.unread_count'))->toBe(5);
});

it('read endpoint: marks a notification as read', function (): void {
    Sanctum::actingAs($this->user);

    $n = new Notification([
        'user_id' => $this->user->id,
        'type' => 'report.assigned',
        'channel' => 'email',
        'payload' => ['rendered' => ['subject' => 's', 'body' => 'b']],
        'status' => Notification::STATUS_SENT,
        'retry_count' => 0,
    ]);
    $n->id = (string) Str::uuid();
    $n->save();

    $this->postJson("/api/v1/notifications/{$n->id}/read")->assertOk();

    expect($n->fresh()->read_at)->not->toBeNull();
});

it('preference endpoint: PUT then GET roundtrips', function (): void {
    Sanctum::actingAs($this->user);

    $this->putJson('/api/v1/notifications/preferences', [
        'preferences' => [
            ['channel' => 'email', 'event_code' => 'report.assigned', 'enabled' => false],
        ],
    ])->assertOk();

    $response = $this->getJson('/api/v1/notifications/preferences');
    $response->assertOk();
    expect($response->json('data.preferences.0.enabled'))->toBeFalse();
});

it('template seeder: 6 default templates land on a fresh DB', function (): void {
    NotificationTemplate::query()->delete();
    (new NotificationTemplatesSeeder)->run();

    expect(NotificationTemplate::query()->count())->toBe(6);
});
