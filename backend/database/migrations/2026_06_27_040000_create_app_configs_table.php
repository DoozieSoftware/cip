<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Feature-flag `app_configs` table per docs/04 §18 and docs/09 §18.
 *
 * Distinct from `settings` (T-M3-010) — `settings` holds free-form
 * key/value configuration; `app_configs` is a typed feature-flag
 * table with three rollout dimensions:
 *
 *  - id                 : UUID primary key
 *  - key                : unique flag name (e.g. "ai.vision.enabled",
 *                         "pwa.video_mandatory")
 *  - value              : JSON column; usually a bool payload but
 *                         reserved for arbitrary structured data
 *  - enabled            : master kill-switch — if false, the flag
 *                         is off for every cohort and user
 *  - rollout_percentage : integer 0-100; when the flag is on, the
 *                         rollout is applied as a deterministic
 *                         hash of the user's id (or session id for
 *                         anonymous users)
 *  - cohort             : JSON array of cohort predicates
 *                         (e.g. [{"role":"moderator","city_id":"…"}])
 *                         — the flag is on if the user matches at
 *                         least one predicate
 *  - description        : human-readable description for the
 *                         Super Admin UI
 *  - timestamps
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_configs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->boolean('enabled')->default(false);
            $table->unsignedTinyInteger('rollout_percentage')->default(0);
            $table->json('cohort')->nullable();
            $table->string('description')->nullable();
            $table->timestamps();

            $table->index('enabled');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_configs');
    }
};
