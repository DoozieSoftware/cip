<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M11 — `report_internal_notes` table per `docs/04` §7.
 *
 * A free-form text note that a department officer attaches to a
 * report. Notes are private to the department (and the Super
 * Admin for cross-department audits) and never visible to the
 * citizen or to officers of other departments. Notes are
 * immutable once written — corrections are made by posting a
 * new note.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_internal_notes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->uuid('department_id');
            $table->uuid('author_id');
            $table->text('body');
            $table->timestamp('created_at')->nullable();

            $table->foreign('report_id')
                ->references('id')->on('reports')
                ->cascadeOnDelete();
            $table->foreign('department_id')
                ->references('id')->on('departments')
                ->cascadeOnDelete();
            $table->foreign('author_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();

            $table->index(['report_id', 'created_at']);
            $table->index(['department_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_internal_notes');
    }
};
