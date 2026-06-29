<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\NotificationPreference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Users\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


it('has the expected columns', function (): void {
    $columns = [
        'id', 'user_id', 'channel', 'event_code', 'enabled',
        'created_at', 'updated_at',
    ];

    foreach ($columns as $col) {
        expect(Schema::hasColumn('notification_preferences', $col))->toBeTrue();
    }
});

it('cascades on user delete', function (): void {
    $user = User::factory()->create();

    $p = new NotificationPreference([
        'user_id' => $user->id,
        'channel' => 'email',
        'event_code' => 'report.assigned',
        'enabled' => true,
    ]);
    $p->id = (string) Str::uuid();
    $p->save();

    $user->forceDelete();

    expect(NotificationPreference::query()->where('id', $p->id)->count())->toBe(0);
});

it('rejects duplicate (user_id, channel, event_code) rows', function (): void {
    $user = User::factory()->create();

    $p = new NotificationPreference([
        'user_id' => $user->id,
        'channel' => 'email',
        'event_code' => 'report.assigned',
        'enabled' => true,
    ]);
    $p->id = (string) Str::uuid();
    $p->save();

    $dup = new NotificationPreference([
        'user_id' => $user->id,
        'channel' => 'email',
        'event_code' => 'report.assigned',
        'enabled' => false,
    ]);
    $dup->id = (string) Str::uuid();

    $dup->save();
})->throws(QueryException::class);
