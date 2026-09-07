<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('textile_offline_submissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('collection_request_id');
            $table->uuid('submitted_by');
            $table->uuid('service_zone_id')->nullable();
            $table->string('idempotency_key', 128)->unique();
            $table->string('outcome', 32);
            $table->unsignedSmallInteger('actual_bags')->nullable();
            $table->decimal('actual_weight_kg', 10, 2)->nullable();
            $table->text('reason')->nullable();
            $table->uuid('proof_media_id')->nullable();
            $table->string('status', 32)->default('pending');
            $table->string('error_code', 64)->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedInteger('retry_count')->default(0);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->foreign('collection_request_id')->references('id')->on('textile_collection_requests')->restrictOnDelete();
            $table->foreign('submitted_by')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('service_zone_id')->references('id')->on('textile_service_zones')->nullOnDelete();
            $table->foreign('proof_media_id')->references('id')->on('media')->nullOnDelete();
            $table->index(['collection_request_id', 'status']);
            $table->index(['submitted_by', 'status']);
            $table->index(['service_zone_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('textile_offline_submissions');
    }
};
