<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


/**
 * Roundtrip test for the refresh_tokens migration introduced in T-M2-006.
 *
 * Per docs/11 §7 (Refresh Token Rotation), the table stores opaque,
 * bcrypt-hashed refresh tokens with a parent_id chain. The user_id FK
 * must cascade on delete and the composite (user_id, expires_at) index
 * supports the per-user active-token sweep.
 */
it('creates the refresh_tokens table with the expected columns', function (): void {
    expect(Schema::hasTable('refresh_tokens'))->toBeTrue();

    foreach (['id', 'user_id', 'token_hash', 'parent_id', 'expires_at', 'revoked_at', 'ip', 'user_agent', 'created_at'] as $column) {
        expect(Schema::hasColumn('refresh_tokens', $column))->toBeTrue("missing column: {$column}");
    }
});

it('is immutable — no updated_at or deleted_at', function (): void {
    expect(Schema::hasColumn('refresh_tokens', 'updated_at'))->toBeFalse();
    expect(Schema::hasColumn('refresh_tokens', 'deleted_at'))->toBeFalse();
});

it('indexes user_id + expires_at composite and expires_at standalone', function (): void {
    $indexes = collect(DB::select('PRAGMA index_list(refresh_tokens)'))->pluck('name')->all();
    expect($indexes)->toContain('refresh_tokens_user_id_expires_at_index')
        ->and($indexes)->toContain('refresh_tokens_expires_at_index');
});

it('roundtrips a row insert + read with FK to users', function (): void {
    $user = User::factory()->citizen()->create();

    $id = (string) Str::uuid();
    DB::table('refresh_tokens')->insert([
        'id' => $id,
        'user_id' => $user->id,
        'token_hash' => password_hash('opaque-refresh-token', PASSWORD_BCRYPT),
        'parent_id' => null,
        'expires_at' => now()->addDays(14),
        'revoked_at' => null,
        'ip' => '10.0.0.1',
        'user_agent' => 'Pest/Test',
        'created_at' => now(),
    ]);

    $row = DB::table('refresh_tokens')->where('id', $id)->first();
    expect($row)->not->toBeNull()
        ->and($row->user_id)->toBe($user->id)
        ->and($row->parent_id)->toBeNull()
        ->and($row->revoked_at)->toBeNull();
});

it('cascades on user force delete', function (): void {
    $user = User::factory()->citizen()->create();
    DB::table('refresh_tokens')->insert([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'token_hash' => 'x',
        'expires_at' => now()->addDays(14),
        'created_at' => now(),
    ]);

    expect(DB::table('refresh_tokens')->where('user_id', $user->id)->count())->toBe(1);

    // forceDelete() removes the row outright, which the FK cascade must
    // follow. Plain delete() is a soft delete (see SoftDeletes trait on
    // the User model).
    $user->forceDelete();

    expect(DB::table('refresh_tokens')->where('user_id', $user->id)->count())->toBe(0);
});

it('supports the rotation chain via parent_id self-reference', function (): void {
    $user = User::factory()->citizen()->create();
    $parentId = (string) Str::uuid();
    $childId = (string) Str::uuid();

    DB::table('refresh_tokens')->insert([
        'id' => $parentId,
        'user_id' => $user->id,
        'token_hash' => 'parent',
        'expires_at' => now()->addDays(14),
        'created_at' => now(),
    ]);
    DB::table('refresh_tokens')->insert([
        'id' => $childId,
        'user_id' => $user->id,
        'token_hash' => 'child',
        'parent_id' => $parentId,
        'expires_at' => now()->addDays(14),
        'created_at' => now(),
    ]);

    $child = DB::table('refresh_tokens')->where('id', $childId)->first();
    expect($child->parent_id)->toBe($parentId);
});
