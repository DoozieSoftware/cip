<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `routing_rules` table per docs/04 sec 12 (Department
 * Routing). One row = one rule. Rules are evaluated by the
 * M7 RoutingEngine in (priority asc, created_at asc) order
 * and the first one whose `conditions` JSON evaluates to
 * true wins; the report is then assigned to the rule's
 * `destination_department_id` (and optionally
 * `default_officer_id`).
 *
 * The `conditions` JSON carries the RoutingCondition DSL
 * payload (see T-M7-003) — keys like `category_in`,
 * `ward_in`, `keyword_match`, etc. — not a single key.
 *
 * Indexes:
 *   - (priority) for the rule-evaluation order
 *   - (active) to skip disabled rules in bulk loads
 *   - (destination_department_id) for the staff-portal
 *     "rules that route to my department" view
 *
 * Soft deletes so a Super Admin can retire a rule without
 * losing the audit trail of past matches.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('routing_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 255);
            $table->integer('priority')->default(100);
            $table->json('conditions');
            $table->uuid('destination_department_id');
            $table->uuid('default_officer_id')->nullable();
            $table->uuid('default_priority_id');
            $table->integer('default_sla_minutes')->default(1440);
            $table->boolean('active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('destination_department_id')
                ->references('id')->on('departments')
                ->restrictOnDelete();
            $table->foreign('default_officer_id')
                ->references('id')->on('users')
                ->nullOnDelete();
            $table->foreign('default_priority_id')
                ->references('id')->on('report_priorities')
                ->restrictOnDelete();

            $table->index('priority');
            $table->index('active');
            $table->index('destination_department_id');
            $table->index('default_officer_id');
            $table->index('deleted_at');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.collation') ?? 'utf8mb4_unicode_ci';
            DB::statement("ALTER TABLE routing_rules ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('routing_rules');
    }
};
