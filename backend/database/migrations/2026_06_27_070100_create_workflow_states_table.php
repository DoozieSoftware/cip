<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `workflow_states` table per docs/04 §11.
 *
 * Each state is a node in the directed graph defined by
 * `workflow_transitions`. A state belongs to exactly one
 * `workflow_definitions` row; the `(workflow_definition_id, code)`
 * pair is the natural key inside a definition.
 *
 *  - `is_initial`  : exactly one of these per definition
 *                    (enforced at the application layer; a
 *                    CHECK on the count would need a subquery
 *                    and is not portable)
 *  - `is_terminal` : 1+ per definition (closed, rejected, ...)
 *  - `sort_order`  : how the definition renders the state list
 *                    in the Super Admin portal
 *  - `color`       : 7-char hex (e.g. #22C55E) for the timeline UI
 *  - `active`      : soft-disable a state without dropping it
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_states', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('workflow_definition_id');
            $table->string('code', 64);
            $table->string('name', 200);
            $table->text('description')->nullable();
            $table->boolean('is_initial')->default(false);
            $table->boolean('is_terminal')->default(false);
            $table->integer('sort_order')->default(0);
            $table->string('color', 9)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->foreign('workflow_definition_id')
                ->references('id')->on('workflow_definitions')
                ->cascadeOnDelete();

            $table->unique(['workflow_definition_id', 'code'], 'uq_workflow_states_def_code');
            $table->index(['workflow_definition_id', 'active']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE workflow_states ADD CONSTRAINT chk_workflow_states_code_nonempty CHECK (CHAR_LENGTH(code) > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_states');
    }
};
