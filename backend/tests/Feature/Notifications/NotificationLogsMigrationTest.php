<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


function seedParentNotification(): string
{
    $user = User::factory()->create();
    $id = (string) Str::uuid();
    DB::table('notifications')->insert([
        'id' => $id,
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'push',
        'payload' => json_encode(['k' => 'v']),
        'status' => 'sent',
        'retry_count' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return $id;
}

it('creates the notification_logs table with the expected columns', function (): void {
    expect(Schema::hasTable('notification_logs'))->toBeTrue();

    foreach ([
        'id', 'notification_id', 'channel', 'status', 'provider_response',
        'latency_ms', 'attempted_at',
    ] as $col) {
        expect(Schema::hasColumn('notification_logs', $col))->toBeTrue("missing column: {$col}");
    }
});

it('roundtrips a log row with default attempted_at', function (): void {
    $parent = seedParentNotification();
    $id = (string) Str::uuid();
    DB::table('notification_logs')->insert([
        'id' => $id,
        'notification_id' => $parent,
        'channel' => 'push',
        'status' => 'sent',
        'provider_response' => json_encode(['message_id' => 'fcm-1234']),
        'latency_ms' => 87,
        'attempted_at' => now(),
    ]);

    $row = DB::table('notification_logs')->where('id', $id)->first();
    expect($row->notification_id)->toBe($parent)
        ->and($row->channel)->toBe('push')
        ->and($row->status)->toBe('sent')
        ->and((int) $row->latency_ms)->toBe(87);
});

it('persists provider_response as JSON', function (): void {
    $parent = seedParentNotification();
    $id = (string) Str::uuid();
    $resp = ['ok' => true, 'message_id' => 'abc', 'error' => null];

    DB::table('notification_logs')->insert([
        'id' => $id,
        'notification_id' => $parent,
        'channel' => 'email',
        'status' => 'sent',
        'provider_response' => json_encode($resp),
        'latency_ms' => 120,
        'attempted_at' => now(),
    ]);

    $row = DB::table('notification_logs')->where('id', $id)->first();
    $decoded = is_string($row->provider_response)
        ? json_decode($row->provider_response, true)
        : (array) $row->provider_response;

    expect($decoded)->toMatchArray($resp);
});

it('cascades logs when the parent notification is deleted', function (): void {
    $parent = seedParentNotification();
    $logId = (string) Str::uuid();
    DB::table('notification_logs')->insert([
        'id' => $logId,
        'notification_id' => $parent,
        'channel' => 'sms',
        'status' => 'failed',
        'provider_response' => null,
        'latency_ms' => null,
        'attempted_at' => now(),
    ]);

    expect(DB::table('notification_logs')->where('id', $logId)->exists())->toBeTrue();
    DB::table('notifications')->where('id', $parent)->delete();
    expect(DB::table('notification_logs')->where('id', $logId)->exists())
        ->toBeFalse('expected log to cascade on parent delete');
});
