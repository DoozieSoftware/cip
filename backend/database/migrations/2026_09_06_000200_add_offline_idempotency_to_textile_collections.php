<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->string('outcome_idempotency_key', 128)->nullable()->after('previous_batch_id');
            $table->timestamp('offline_queued_at')->nullable()->after('outcome_idempotency_key');
            $table->unique('outcome_idempotency_key', 'textile_requests_outcome_idempotency_unique');
        });

        Schema::create('textile_offline_recovery_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('collection_request_id');
            $table->uuid('reported_by');
            $table->string('idempotency_key', 128)->nullable();
            $table->string('failure_reason', 500)->nullable();
            $table->json('payload_snapshot')->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamp('resolved_at')->nullable();
            $table->uuid('resolved_by')->nullable();
            $table->timestamps();
            $table->foreign('collection_request_id')->references('id')->on('textile_collection_requests')->cascadeOnDelete();
            $table->foreign('reported_by')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['reported_by', 'status']);
            $table->index(['collection_request_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('textile_offline_recovery_items');
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->dropUnique('textile_requests_outcome_idempotency_unique');
            $table->dropColumn(['outcome_idempotency_key', 'offline_queued_at']);
        });
    }
};
