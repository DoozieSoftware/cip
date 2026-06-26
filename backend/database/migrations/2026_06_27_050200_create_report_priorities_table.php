<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `report_priorities` table per docs/04 §7.
 *
 * 5 priority levels: Low, Medium, High, Critical, Emergency.
 * `sla_minutes` is the default service-level target the Workflow
 * engine uses when a report has no per-department override.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_priorities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->unsignedInteger('sla_minutes');
            $table->string('color', 16)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_priorities');
    }
};
