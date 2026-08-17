<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_types', function (Blueprint $table): void {
            $table->unsignedInteger('response_target_minutes')
                ->nullable()
                ->default(2880)
                ->after('max_photos');
        });
    }

    public function down(): void
    {
        Schema::table('report_types', function (Blueprint $table): void {
            $table->dropColumn('response_target_minutes');
        });
    }
};
