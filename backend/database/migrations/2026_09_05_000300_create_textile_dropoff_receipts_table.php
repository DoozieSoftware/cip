<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('textile_dropoff_receipts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('collection_request_id')->unique();
            $table->uuid('received_by');
            $table->uuid('service_zone_id');
            $table->timestamp('received_at');
            $table->unsignedSmallInteger('actual_bags')->nullable();
            $table->decimal('actual_weight_kg', 10, 2)->nullable();
            $table->uuid('proof_media_id')->nullable();
            $table->string('exception_code', 32)->nullable();
            $table->text('exception_reason')->nullable();
            $table->string('idempotency_key', 128)->nullable()->unique();
            $table->timestamps();
            $table->foreign('collection_request_id')->references('id')->on('textile_collection_requests')->restrictOnDelete();
            $table->foreign('received_by')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('service_zone_id')->references('id')->on('textile_service_zones')->restrictOnDelete();
            $table->foreign('proof_media_id')->references('id')->on('media')->nullOnDelete();
            $table->index(['service_zone_id','received_at']);
            $table->index(['received_by','received_at']);
            // TODO D-02: signature_captured, captured_lat/lng, staff_device_id pending D-08/D-02
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('textile_dropoff_receipts');
    }
};
