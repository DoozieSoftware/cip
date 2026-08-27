<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('textile_service_zones', function (Blueprint $table): void {
            $table->json('operating_hours')->nullable()->after('dropoff_address');
            $table->string('public_phone', 32)->nullable()->after('operating_hours');
            $table->string('centre_status', 16)->default('open')->after('public_phone');
            $table->text('centre_closed_note')->nullable()->after('centre_status');
            $table->boolean('receipt_requires_photo')->default(true)->after('centre_closed_note');
            $table->boolean('receipt_requires_bags')->default(true)->after('receipt_requires_photo');
            $table->boolean('receipt_requires_weight')->default(true)->after('receipt_requires_bags');
            $table->smallInteger('max_open_dropoffs_per_citizen')->nullable()->after('receipt_requires_weight');
            // TODO D-01..D-03,D-07: separate textile_dropoff_centres pending multi-centre decision
            $table->index('centre_status');
        });
    }

    public function down(): void
    {
        Schema::table('textile_service_zones', function (Blueprint $table): void {
            $table->dropIndex(['centre_status']);
            $table->dropColumn(['operating_hours','public_phone','centre_status','centre_closed_note','receipt_requires_photo','receipt_requires_bags','receipt_requires_weight','max_open_dropoffs_per_citizen']);
        });
    }
};
