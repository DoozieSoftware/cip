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
            $table->timestamp('dropoff_confirmed_at')->nullable()->after('status');
            $table->date('dropoff_valid_from')->nullable()->after('dropoff_confirmed_at');
            $table->date('dropoff_valid_until')->nullable()->after('dropoff_valid_from');
            $table->uuid('receipt_id')->nullable()->after('dropoff_valid_until');
            $table->unsignedSmallInteger('stop_order')->nullable()->after('receipt_id');
            // TODO D-04 stop_order option (a) vs textile_batch_stops (b); keeping column for now
            // Explicit names: MySQL identifiers are capped at 64 chars and the
            // Laravel-generated names for these column sets exceed that limit.
            $table->index(['service_zone_id', 'status', 'collection_method'], 'tcr_zone_status_method_idx');
            $table->index(['batch_id', 'stop_order'], 'tcr_batch_stop_order_idx');
        });
    }

    public function down(): void
    {
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->dropIndex('tcr_batch_stop_order_idx');
            $table->dropIndex('tcr_zone_status_method_idx');
            $table->dropColumn(['dropoff_confirmed_at', 'dropoff_valid_from', 'dropoff_valid_until', 'receipt_id', 'stop_order']);
        });
    }
};
