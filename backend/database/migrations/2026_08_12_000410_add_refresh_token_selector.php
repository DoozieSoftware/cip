<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table): void {
            $table->string('token_selector', 16)->nullable()->after('token_hash');
            $table->index('token_selector', 'refresh_tokens_selector_index');
        });
    }

    public function down(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table): void {
            $table->dropIndex('refresh_tokens_selector_index');
            $table->dropColumn('token_selector');
        });
    }
};
