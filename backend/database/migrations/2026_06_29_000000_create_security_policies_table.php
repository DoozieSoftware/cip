<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T-M12-010 — `security_policies` table.
 *
 * One row per policy key. The current implementation
 * uses one row per `key` (Password Policy, OTP Expiry,
 * JWT Lifetime, …) so the Super Admin screen can edit
 * each independently. New keys can be added without a
 * schema change.
 *
 *  - `key` is the stable identifier (e.g. `password.min_length`)
 *  - `value` is the typed payload (cast to array)
 *  - `type` hints the renderer (string|int|bool|array)
 *  - `description` is the human label
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('key', 128)->unique();
            $table->json('value')->nullable();
            $table->string('type', 16)->default('string');
            $table->string('description', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_policies');
    }
};
