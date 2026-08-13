<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_proof_verifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->uuid('assignment_id')->nullable();
            $table->uuid('department_id')->nullable();
            $table->uuid('evidence_media_id')->nullable();
            $table->uuid('proof_media_id');
            $table->string('status', 32);
            $table->unsignedTinyInteger('location_confidence')->default(0);
            $table->unsignedTinyInteger('visual_confidence')->default(0);
            $table->unsignedTinyInteger('overall_confidence')->default(0);
            $table->decimal('distance_meters', 8, 2)->nullable();
            $table->boolean('location_match')->nullable();
            $table->string('summary', 512);
            $table->text('perspective_note')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('checked_at');
            $table->timestamps();

            $table->foreign('report_id')
                ->references('id')->on('reports')
                ->cascadeOnDelete();
            $table->foreign('assignment_id')
                ->references('id')->on('report_assignments')
                ->nullOnDelete();
            $table->foreign('department_id')
                ->references('id')->on('departments')
                ->nullOnDelete();
            $table->foreign('evidence_media_id')
                ->references('id')->on('media')
                ->nullOnDelete();
            $table->foreign('proof_media_id')
                ->references('id')->on('media')
                ->cascadeOnDelete();

            $table->unique('proof_media_id', 'proof_verifications_proof_unique');
            $table->index(['report_id', 'assignment_id', 'checked_at'], 'proof_verifications_report_assignment_idx');
            $table->index(['status', 'checked_at'], 'proof_verifications_status_idx');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE report_proof_verifications
                 ADD CONSTRAINT proof_verifications_status_check
                 CHECK (status IN ('match','needs_review','mismatch'))"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE report_proof_verifications DROP CONSTRAINT proof_verifications_status_check');
        }

        Schema::dropIfExists('report_proof_verifications');
    }
};
