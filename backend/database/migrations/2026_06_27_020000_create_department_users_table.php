<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pivot `department_users` table per docs/04 §5 (Department Domain).
 *
 * M:N relation between `users` and `departments`. Each row says
 * "this user is a member of this department"; `is_manager` flips
 * the role to "manager of this department's reports"; `assigned_at`
 * is the immutable assignment timestamp used for audit and for the
 * "current department" heuristic on staff logins.
 *
 *  - id              : UUID primary key
 *  - user_id         : UUID FK → users.id (cascadeOnDelete: the
 *                       pivot dies when the user is hard-deleted
 *                       and we don't soft-delete users)
 *  - department_id   : UUID FK → departments.id (restrictOnDelete:
 *                       you must remove assignments before
 *                       dissolving a department; mirrors D-014)
 *  - is_manager      : bool default false
 *  - assigned_at     : timestamp (defaults to now; never updated
 *                       after creation — re-assignment is a new row)
 *  - timestamps
 *  - unique (user_id, department_id) — a user is at most one
 *    member of any given department
 *  - index (department_id, is_manager) — fast "who is the
 *    manager?" lookup
 *  - index (user_id) — fast "what departments does this user
 *    belong to?" lookup
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('department_users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('department_id');
            $table->boolean('is_manager')->default(false);
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();
            $table->foreign('department_id')
                ->references('id')->on('departments')
                ->restrictOnDelete();
            $table->unique(['user_id', 'department_id']);
            $table->index(['department_id', 'is_manager']);
            $table->index('user_id');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE department_users ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('department_users');
    }
};
