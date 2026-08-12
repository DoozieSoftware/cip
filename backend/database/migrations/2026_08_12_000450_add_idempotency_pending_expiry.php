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
            $table->timestamp('pending_expires_at')->nullable()->after('response_body');
            $table->index(['response_status', 'pending_expires_at'], 'idempotency_pending_expiry_index');
        });
    }

    public function down(): void
    {
        Schema::table('idempotency_keys', function (Blueprint $table): void {
            $table->dropIndex('idempotency_pending_expiry_index');
            $table->dropColumn('pending_expires_at');
        });
    }
};
