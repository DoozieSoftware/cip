<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Requesters often do not know how much their textiles weigh. Volume
 * stays an estimate for route planning, but either bags OR weight is
 * enough — both columns become nullable and the FormRequest enforces
 * "at least one" instead of requiring both.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->unsignedSmallInteger('estimated_bags')->nullable()->change();
            $table->decimal('estimated_weight_kg', 10, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->unsignedSmallInteger('estimated_bags')->nullable(false)->change();
            $table->decimal('estimated_weight_kg', 10, 2)->nullable(false)->change();
        });
    }
};
