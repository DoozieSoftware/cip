<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_analytics_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('event_code', 80);
            $table->json('properties')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
            $table->timestamps();
            $table->index(['event_code', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_analytics_events');
    }
};
