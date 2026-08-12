<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_results', function (Blueprint $table): void {
            // One immutable result per job; firstOrCreate remains safe when
            // retried workers race to persist the same successful attempt.
            $table->unique('job_id', 'ai_results_job_id_unique');
        });

        Schema::table('ai_labels', function (Blueprint $table): void {
            // A provider label must occur once per result. This prevents a
            // retry from duplicating the canonical label set.
            $table->unique(['result_id', 'label'], 'ai_labels_result_label_unique');
        });
    }

    public function down(): void
    {
        Schema::table('ai_labels', function (Blueprint $table): void {
            $table->dropUnique('ai_labels_result_label_unique');
        });

        Schema::table('ai_results', function (Blueprint $table): void {
            $table->dropUnique('ai_results_job_id_unique');
        });
    }
};
