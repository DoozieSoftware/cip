<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


it('creates the notifications table with the expected columns', function (): void {
    expect(Schema::hasTable('notifications'))->toBeTrue();

    foreach ([
        'id', 'user_id', 'type', 'channel', 'payload', 'status',
        'read_at', 'scheduled_at', 'retry_count', 'last_error',
        'created_at', 'updated_at',
    ] as $col) {
        expect(Schema::hasColumn('notifications', $col))->toBeTrue("missing column: {$col}");
    }
});

it('roundtrips a notification row with the default status pending', function (): void {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    DB::table('notifications')->insert([
        'id' => $id,
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'push',
        'payload' => json_encode(['report_id' => (string) Str::uuid()]),
        'status' => 'pending',
        'retry_count' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $row = DB::table('notifications')->where('id', $id)->first();
    expect($row->user_id)->toBe($user->id)
        ->and($row->type)->toBe('report_status_changed')
        ->and($row->channel)->toBe('push')
        ->and($row->status)->toBe('pending')
        ->and((int) $row->retry_count)->toBe(0);
});

it('preserves a JSON payload in the payload column', function (): void {
    $user = User::factory()->create();
    $id = (string) Str::uuid();
    $payload = ['report_id' => (string) Str::uuid(), 'status' => 'in_progress', 'priority' => 2];

    DB::table('notifications')->insert([
        'id' => $id,
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'email',
        'payload' => json_encode($payload),
        'status' => 'pending',
        'retry_count' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $row = DB::table('notifications')->where('id', $id)->first();
    $decoded = is_string($row->payload) ? json_decode($row->payload, true) : (array) $row->payload;
    expect($decoded)->toMatchArray($payload);
});

it('has the (user_id, status) and scheduled_at indexes', function (): void {
    $indexes = collect(Schema::getIndexes('notifications'));

    $userStatus = $indexes->first(fn ($i) => $i['columns'] === ['user_id', 'status']);
    expect($userStatus)->not->toBeNull('missing (user_id, status) index');

    $scheduled = $indexes->first(fn ($i) => $i['columns'] === ['scheduled_at']);
    expect($scheduled)->not->toBeNull('missing scheduled_at index');
});

it('cascades notifications when the parent user is deleted', function (): void {
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

    expect(DB::table('notifications')->where('id', $id)->exists())->toBeTrue();
    $user->forceDelete();
    expect(DB::table('notifications')->where('id', $id)->exists())
        ->toBeFalse('expected notification to cascade on user delete');
});
