<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retention_holds', function (Blueprint $table): void {
            $table->uuid('released_by')->nullable()->after('released_at');
            $table->text('release_reason')->nullable()->after('released_by');
            $table->foreign('released_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('retention_holds', function (Blueprint $table): void {
            $table->dropForeign(['released_by']);
            $table->dropColumn(['released_by', 'release_reason']);
        });
    }
};
