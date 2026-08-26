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
        Schema::create('textile_service_zones', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->decimal('center_latitude', 10, 7)->nullable();
            $table->decimal('center_longitude', 10, 7)->nullable();
            $table->decimal('service_radius_km', 8, 2)->nullable();
            $table->boolean('dropoff_enabled')->default(true);
            $table->boolean('premises_pickup_enabled')->default(true);
            $table->string('dropoff_name')->nullable();
            $table->text('dropoff_address')->nullable();
            $table->text('readiness_instructions')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['active', 'name']);
        });

        Schema::create('textile_collection_batches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('service_zone_id');
            $table->string('reference', 32)->unique();
            $table->date('collection_date');
            $table->time('window_start')->nullable();
            $table->time('window_end')->nullable();
            $table->string('status', 32)->default('planned');
            $table->string('trip_reference', 64)->nullable();
            $table->text('instructions')->nullable();
            $table->uuid('created_by');
            $table->timestamps();

            $table->foreign('service_zone_id')->references('id')->on('textile_service_zones')->restrictOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->restrictOnDelete();
            $table->index(['service_zone_id', 'collection_date']);
            $table->index('status');
        });

        Schema::create('textile_collection_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('report_id')->unique();
            $table->uuid('service_zone_id');
            $table->uuid('batch_id')->nullable();
            $table->string('requester_type', 16);
            $table->string('requester_name');
            $table->string('rwa_name')->nullable();
            $table->string('contact_email');
            $table->string('contact_phone', 32);
            $table->text('pickup_address');
            $table->string('collection_method', 24);
            $table->unsignedSmallInteger('estimated_bags');
            $table->decimal('estimated_weight_kg', 10, 2);
            $table->string('status', 32)->default('pending_review');
            $table->date('scheduled_date')->nullable();
            $table->time('scheduled_window_start')->nullable();
            $table->time('scheduled_window_end')->nullable();
            $table->text('readiness_instructions')->nullable();
            $table->unsignedSmallInteger('actual_bags')->nullable();
            $table->decimal('actual_weight_kg', 10, 2)->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->text('missed_pickup_reason')->nullable();
            $table->timestamp('picked_up_at')->nullable();
            $table->timestamps();

            $table->foreign('report_id')->references('id')->on('reports')->cascadeOnDelete();
            $table->foreign('service_zone_id')->references('id')->on('textile_service_zones')->restrictOnDelete();
            $table->foreign('batch_id')->references('id')->on('textile_collection_batches')->nullOnDelete();
            $table->index(['service_zone_id', 'status']);
            $table->index(['batch_id', 'status']);
            $table->index('scheduled_date');
            $table->index('contact_phone');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $engine = DB::getConfig('connections.mysql.engine') ?? 'InnoDB';
            $charset = DB::getConfig('connections.mysql.charset') ?? 'utf8mb4';
            $collation = DB::getConfig('connections.mysql.collation') ?? 'utf8mb4_unicode_ci';

            foreach (['textile_service_zones', 'textile_collection_batches', 'textile_collection_requests'] as $table) {
                DB::statement("ALTER TABLE {$table} ENGINE = {$engine} DEFAULT CHARACTER SET = {$charset} COLLATE = {$collation}");
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('textile_collection_requests');
        Schema::dropIfExists('textile_collection_batches');
        Schema::dropIfExists('textile_service_zones');
    }
};
