<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retention_holds', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('entity_type', 191);
            $table->uuid('entity_id');
            $table->text('reason');
            $table->uuid('held_by')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
            $table->index(['entity_type', 'entity_id', 'released_at'], 'retention_holds_entity_active_index');
            $table->foreign('held_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retention_holds');
    }
};
