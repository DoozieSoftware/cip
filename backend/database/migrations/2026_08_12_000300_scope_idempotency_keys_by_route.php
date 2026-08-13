<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('idempotency_keys', function (Blueprint $table): void {
            $table->string('method', 10)->default('POST')->after('route');
            $table->dropUnique(['key', 'user_id']);
            $table->unique(['key', 'user_id', 'route', 'method']);
        });
    }

    public function down(): void
    {
        Schema::table('idempotency_keys', function (Blueprint $table): void {
            $table->dropUnique(['key', 'user_id', 'route', 'method']);
            $table->dropColumn('method');
            $table->unique(['key', 'user_id']);
        });
    }
};
