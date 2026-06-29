<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Users\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);


it('creates the department_users table with the required columns', function (): void {
    expect(Schema::hasTable('department_users'))->toBeTrue();

    foreach ([
        'id', 'user_id', 'department_id', 'is_manager', 'assigned_at',
        'created_at', 'updated_at',
    ] as $column) {
        expect(Schema::hasColumn('department_users', $column))->toBeTrue("department_users.{$column} must exist");
    }
});

it('enforces a FK from department_users.user_id to users.id', function (): void {
    expect(fn () => DB::table('department_users')->insert([
        'id' => (string) Str::uuid(),
        'user_id' => '00000000-0000-0000-0000-000000000000',
        'department_id' => (string) Str::uuid(),
        'is_manager' => false,
        'assigned_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});

it('enforces a FK from department_users.department_id to departments.id', function (): void {
    $user = User::factory()->create();

    expect(fn () => DB::table('department_users')->insert([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'department_id' => '00000000-0000-0000-0000-000000000000',
        'is_manager' => false,
        'assigned_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});

it('enforces a unique (user_id, department_id) pair', function (): void {
    $user = User::factory()->create();
    $dept = Department::factory()->create();
    $now = now();

    DB::table('department_users')->insert([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'department_id' => $dept->id,
        'is_manager' => false,
        'assigned_at' => $now,
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    expect(fn () => DB::table('department_users')->insert([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'department_id' => $dept->id,
        'is_manager' => true,
        'assigned_at' => $now,
        'created_at' => $now,
        'updated_at' => $now,
    ]))->toThrow(QueryException::class);
});

it('cascades a hard delete from users to department_users', function (): void {
    $user = User::factory()->create();
    $dept = Department::factory()->create();
    $now = now();

    DB::table('department_users')->insert([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'department_id' => $dept->id,
        'is_manager' => false,
        'assigned_at' => $now,
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    // Users soft-delete by default; the cascade only fires on a
    // hard delete (FK is set to ON DELETE CASCADE, not on
    // soft delete — that is intentional, see D-014).
    $user->forceDelete();

    expect(DB::table('department_users')->where('user_id', $user->id)->count())->toBe(0);
});

it('keeps the pivot row when a soft-deleted user is restored (cascade only on hard delete)', function (): void {
    $user = User::factory()->create();
    $dept = Department::factory()->create();
    $now = now();

    DB::table('department_users')->insert([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'department_id' => $dept->id,
        'is_manager' => false,
        'assigned_at' => $now,
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    $user->delete();
    expect(DB::table('department_users')->where('user_id', $user->id)->count())->toBe(1);

    $user->restore();
    expect(DB::table('department_users')->where('user_id', $user->id)->count())->toBe(1);
});
