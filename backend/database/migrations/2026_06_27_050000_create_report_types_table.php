<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `report_types` table per docs/04 §7.
 *
 * Categories are NEVER hardcoded in code (docs/02 §8). Every
 * report_type is a row in this table; the citizen PWA reads the
 * active set from the master-config endpoint (T-M3-019) and the
 * Reports domain reads it from `ReportType::query()`.
 *
 *  - id                    : UUID PK
 *  - name                  : display name (e.g. "Pothole")
 *  - code                  : unique stable identifier (e.g. "pothole")
 *  - description           : optional long description
 *  - icon                  : icon name from the design system
 *  - color                 : hex color string (#RRGGBB)
 *  - department_default_id : UUID FK → departments.id (the routing
 *                            engine's first pick; may be overridden
 *                            by a routing rule)
 *  - requires_video        : bool — true blocks submission without
 *                            at least one video attachment
 *  - requires_photo        : bool — true blocks submission without
 *                            at least one photo attachment
 *  - min_photos            : int — minimum photo count
 *  - max_photos            : int — maximum photo count
 *  - workflow_definition_id: UUID FK → workflow_definitions.id
 *                            (M6) — null until the workflow is
 *                            seeded; the M6 backfill will populate
 *  - validation_rules      : JSON — per-field rule overrides
 *  - active                : soft-disable flag
 *  - timestamps, soft deletes
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_types', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('code', 64)->unique();
            $table->text('description')->nullable();
            $table->string('icon', 64)->nullable();
            $table->string('color', 16)->nullable();
            $table->uuid('department_default_id')->nullable();
            $table->boolean('requires_video')->default(false);
            $table->boolean('requires_photo')->default(true);
            $table->unsignedSmallInteger('min_photos')->default(1);
            $table->unsignedSmallInteger('max_photos')->default(5);
            $table->uuid('workflow_definition_id')->nullable();
            $table->json('validation_rules')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('department_default_id')
                ->references('id')->on('departments')
                ->nullOnDelete();
            $table->index('active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_types');
    }
};
