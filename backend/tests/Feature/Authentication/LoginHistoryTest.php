<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('creates the login_histories table with the expected columns', function (): void {
    expect(Schema::hasTable('login_histories'))->toBeTrue();

    foreach (['id', 'user_id', 'mobile', 'ip', 'user_agent', 'device_fingerprint', 'success', 'failure_reason', 'login_at'] as $column) {
        expect(Schema::hasColumn('login_histories', $column))->toBeTrue("missing column: {$column}");
    }
});

it('is immutable — no updated_at or deleted_at', function (): void {
    expect(Schema::hasColumn('login_histories', 'updated_at'))->toBeFalse();
    expect(Schema::hasColumn('login_histories', 'deleted_at'))->toBeFalse();
});

it('roundtrips a successful login row', function (): void {
    $user = User::factory()->citizen()->create();

    $history = LoginHistory::query()->create([
        'user_id' => $user->id,
        'mobile' => $user->mobile,
        'ip' => '10.0.0.1',
        'user_agent' => 'Pest/Test',
        'device_fingerprint' => str_repeat('a', 64),
        'success' => true,
        'failure_reason' => null,
        'login_at' => now(),
    ]);

    expect($history->id)->toBeString()->and(strlen($history->id))->toBe(36)
        ->and($history->success)->toBeTrue()
        ->and($history->failure_reason)->toBeNull()
        ->and($history->user_id)->toBe($user->id)
        ->and($history->mobile)->toBe($user->mobile)
        ->and($history->user->id)->toBe($user->id);
});

it('persists a failure attempt for a mobile that has no user yet', function (): void {
    $history = LoginHistory::query()->create([
        'user_id' => null,
        'mobile' => '9876543210',
        'ip' => '10.0.0.2',
        'success' => false,
        'failure_reason' => 'invalid_code',
        'login_at' => now(),
    ]);

    expect($history->success)->toBeFalse()
        ->and($history->failure_reason)->toBe('invalid_code')
        ->and($history->user_id)->toBeNull()
        ->and($history->user)->toBeNull();
});

it('has a composite index on success + login_at for stream queries', function (): void {
    $indexes = collect(DB::select('PRAGMA index_list(login_histories)'))->pluck('name')->all();
    expect($indexes)->toContain('login_histories_success_login_at_index');
});
