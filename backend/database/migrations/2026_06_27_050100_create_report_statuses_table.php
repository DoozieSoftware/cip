<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `report_statuses` table per docs/04 §7.
 *
 * The 11 lifecycle states from docs/02 §7:
 *   Draft, Submitted, AI Processing, Pending Moderator, Assigned,
 *   Accepted, In Progress, Resolved, Verified, Closed, Rejected.
 *
 *  - id          : UUID PK
 *  - code        : unique stable identifier (e.g. "draft", "submitted")
 *  - name        : display name
 *  - description : optional long description
 *  - color       : hex color string (#RRGGBB)
 *  - is_terminal : bool — true for the end-of-workflow states
 *                  (Verified, Closed, Rejected)
 *  - sort_order  : int — display order in the moderator queue
 *  - active      : soft-disable flag
 *  - timestamps
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_statuses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color', 16)->nullable();
            $table->boolean('is_terminal')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_statuses');
    }
};
