<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Citizen self-service profile fields.
 *
 * These are deliberately separate from the verified mobile and legal name
 * fields. A citizen can choose how the platform addresses them, in which
 * language it speaks, and which approved notification channel is preferred
 * without visiting an office or changing their identity proof.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('preferred_name', 120)->nullable()->after('name');
            $table->string('preferred_locale', 8)->nullable()->after('email');
            $table->string('notification_channel', 16)->default('sms')->after('preferred_locale');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['preferred_name', 'preferred_locale', 'notification_channel']);
        });
    }
};
