<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Master `departments` table per docs/04 §5 (Department Domain) and
 * docs/09 §7 (Super Admin → Department Management).
 *
 *  - id                  : UUID primary key
 *  - name                : display name
 *  - code                : short, unique slug (e.g. "PWD", "ELEC")
 *  - parent_id           : UUID self-FK → departments.id (nullable;
 *                          top-level departments have no parent)
 *  - jurisdiction        : free-text scope ("Ward 12 / Zone 3",
 *                          "City-wide", etc.)
 *  - address             : office address
 *  - email               : public-facing contact email
 *  - phone               : public-facing contact phone
 *  - working_hours       : JSON schedule (per-day open/close windows)
 *  - holiday_calendar    : JSON list of holiday dates / rules
 *  - default_workflow_id : UUID FK → workflow_definitions.id
 *                          (nullable; assigned per-category later
 *                          by the routing engine)
 *  - default_sla_minutes : integer default SLA window used when a
 *                          report is routed here without an
 *                          explicit SLA policy
 *  - escalation_matrix   : JSON list of escalation rules
 *                          (delay_minutes → escalate_to_user_id
 *                          or escalate_to_role)
 *  - active              : soft-disable flag
 *  - timestamps, deleted_at (SoftDeletes)
 *
 * `workflow_definitions` does not exist yet — it ships in T-M3-014
 * (and the FK is created there as a follow-up migration). Adding the
 * column here without the FK keeps the schema consistent with the
 * eventual model and lets the Super Admin Portal bind a workflow
 * without a second migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('code', 32);
            $table->uuid('parent_id')->nullable();
            $table->string('jurisdiction')->nullable();
            $table->text('address')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 32)->nullable();
            $table->json('working_hours')->nullable();
            $table->json('holiday_calendar')->nullable();
            $table->uuid('default_workflow_id')->nullable();
            $table->unsignedInteger('default_sla_minutes')->default(2880);
            $table->json('escalation_matrix')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique('code');
            $table->foreign('parent_id')
                ->references('id')->on('departments')
                ->nullOnDelete();
            $table->index('active');
            $table->index('parent_id');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE departments ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('departments');
    }
};
