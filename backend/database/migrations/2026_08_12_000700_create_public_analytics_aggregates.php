<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('public_daily_metrics', function (Blueprint $table): void {
            $table->date('metric_date')->primary();
            $table->unsignedInteger('total_reports')->default(0);
            $table->unsignedInteger('ai_classified_reports')->default(0);
            $table->unsignedInteger('median_assign_seconds')->nullable();
            $table->string('version', 32)->default('v1');
            $table->timestamp('generated_at')->useCurrent();
        });

        Schema::create('public_ward_daily_facts', function (Blueprint $table): void {
            $table->date('metric_date');
            $table->string('ward_id', 36);
            $table->unsignedInteger('report_count')->default(0);
            $table->unsignedInteger('resolved_count')->default(0);
            $table->string('version', 32)->default('v1');
            $table->timestamp('generated_at')->useCurrent();
            $table->primary(['metric_date', 'ward_id']);
            $table->index(['ward_id', 'metric_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_ward_daily_facts');
        Schema::dropIfExists('public_daily_metrics');
    }
};
