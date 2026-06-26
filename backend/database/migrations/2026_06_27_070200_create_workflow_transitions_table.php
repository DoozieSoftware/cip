<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `workflow_transitions` table per docs/04 §11.
 *
 * Each row is a directed edge in the workflow graph. When a
 * `Report` is in `from_state_id` and the system or an actor
 * publishes `event`, the engine resolves the row with the
 * highest `priority` that the actor is allowed to take and
 * fires the transition.
 *
 *  - `required_role`        : the Spatie role the actor must
 *                             have to fire this transition
 *                             (e.g. `moderator`).
 *  - `required_permission`  : alternative — the Spatie permission
 *                             the actor must have.
 *  - `conditions`           : JSON expression evaluated by the
 *                             engine against the Report /
 *                             Actor context. See
 *                             WorkflowEngine::matchesConditions().
 *  - `sla_minutes`          : the deadline from `created_at`.
 *  - `notify_before_minutes`: send a "this is about to breach"
 *                             notification N minutes before the
 *                             SLA expires.
 *  - `priority`             : when multiple transitions share
 *                             the same (from, event) the one
 *                             with the highest priority wins.
 *  - `active`               : soft-disable a transition.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_transitions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('workflow_definition_id');
            $table->uuid('from_state_id');
            $table->uuid('to_state_id');
            $table->string('event', 64);
            $table->string('required_role', 64)->nullable();
            $table->string('required_permission', 64)->nullable();
            $table->json('conditions')->nullable();
            $table->integer('sla_minutes')->nullable();
            $table->integer('notify_before_minutes')->nullable();
            $table->integer('priority')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->foreign('workflow_definition_id')
                ->references('id')->on('workflow_definitions')
                ->cascadeOnDelete();
            $table->foreign('from_state_id')
                ->references('id')->on('workflow_states')
                ->cascadeOnDelete();
            $table->foreign('to_state_id')
                ->references('id')->on('workflow_states')
                ->restrictOnDelete();

            // The engine resolves transitions by (from_state,
            // event) ordered by priority DESC. The unique key
            // is intentionally non-strict: multiple rows may
            // share the same (from, event) when the role /
            // permission / conditions differ.
            $table->index(['from_state_id', 'event', 'priority'], 'idx_workflow_trans_from_event_pri');
            $table->index(['workflow_definition_id', 'active']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE workflow_transitions ADD CONSTRAINT chk_workflow_trans_event_nonempty CHECK (CHAR_LENGTH(event) > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_transitions');
    }
};
