<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('textile_capacity_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('service_zone_id');
            $table->uuid('department_id');
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->unsignedSmallInteger('day_of_week')->nullable()->comment('0=Sun..6=Sat, null=every day');
            $table->unsignedInteger('max_bags')->nullable();
            $table->decimal('max_weight_kg', 10, 2)->nullable();
            $table->unsignedInteger('max_stops')->nullable();
            $table->unsignedInteger('min_bags')->nullable();
            $table->decimal('min_weight_kg', 10, 2)->nullable();
            $table->json('vehicle_requirements')->nullable();
            $table->json('category_allowlist')->nullable();
            $table->text('guidance_text')->nullable();
            $table->text('policy_notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('service_zone_id')->references('id')->on('textile_service_zones')->cascadeOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['service_zone_id', 'department_id']);
            $table->index(['department_id', 'effective_from', 'effective_to'], 'tcrule_dept_effective_idx');
            $table->index('day_of_week');
        });

        Schema::create('textile_capacity_exceptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('collection_request_id');
            $table->uuid('service_zone_id')->nullable();
            $table->uuid('department_id');
            $table->uuid('requested_by')->nullable();
            $table->string('status', 20)->default('pending')->comment('pending, approved, rejected');
            $table->string('reason_code', 32)->nullable()->comment('below_minimum, high_value, urgent, vehicle_mismatch, capacity_override');
            $table->text('reason')->nullable();
            $table->json('payload_snapshot')->nullable();
            $table->json('decision_payload')->nullable();
            $table->uuid('decided_by')->nullable();
            $table->text('decided_reason')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->string('idempotency_key', 128)->nullable()->unique();
            $table->timestamps();

            $table->foreign('collection_request_id')->references('id')->on('textile_collection_requests')->cascadeOnDelete();
            $table->foreign('service_zone_id')->references('id')->on('textile_service_zones')->nullOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->cascadeOnDelete();
            $table->foreign('requested_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('decided_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['department_id', 'status']);
            $table->index(['collection_request_id', 'status']);
            $table->index(['requested_by', 'status']);
        });

        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->uuid('capacity_exception_id')->nullable()->after('receipt_id');
            $table->timestamp('capacity_checked_at')->nullable()->after('capacity_exception_id');
            $table->json('capacity_context')->nullable()->after('capacity_checked_at')->comment('Snapshot of rule values at decision time');
            $table->foreign('capacity_exception_id')->references('id')->on('textile_capacity_exceptions')->nullOnDelete();
            $table->index('capacity_exception_id');
        });
    }

    public function down(): void
    {
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->dropForeign(['capacity_exception_id']);
            $table->dropColumn(['capacity_exception_id', 'capacity_checked_at', 'capacity_context']);
        });
        Schema::dropIfExists('textile_capacity_exceptions');
        Schema::dropIfExists('textile_capacity_rules');
    }
};
