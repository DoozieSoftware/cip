<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `workflow_definitions` table per docs/04 §11.
 *
 * A workflow definition is the named, versioned state machine
 * a report flows through. The actual states and transitions
 * live in the `workflow_states` and `workflow_transitions`
 * tables; this row carries the human-readable name, the
 * machine code (used by `reports.workflow_id` and the API
 * `?workflow=...` filter), an active flag, and soft-delete
 * support so a Super Admin can retire a definition without
 * losing the audit trail of historical reports that used it.
 *
 * `code` is the natural key. Reports that were on this
 * definition keep referencing it even after `active=false`,
 * so the soft delete column is purely administrative.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_definitions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 200);
            $table->string('code', 64)->unique();
            $table->text('description')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('active');
        });

        // MySQL CHECK that code is non-empty.
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE workflow_definitions ADD CONSTRAINT chk_workflow_definitions_code_nonempty CHECK (CHAR_LENGTH(code) > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_definitions');
    }
};
