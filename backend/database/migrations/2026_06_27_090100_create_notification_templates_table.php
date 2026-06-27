<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `notification_templates` table per docs/04 §13.
 *
 * Reusable notification templates keyed by (code, locale,
 * version). The dispatcher loads the active version for
 * (code, locale) at send time and renders `body` with the
 * payload's variables.
 *
 * Uniqueness on (code, locale, version) so two writers
 * cannot accidentally create a conflicting version.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 128);
            $table->string('name', 255);
            $table->string('channel', 16);
            $table->string('subject', 255)->nullable();
            $table->text('body');
            $table->json('variables')->nullable();
            $table->string('locale', 8)->default('en');
            $table->unsignedInteger('version')->default(1);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['code', 'locale', 'version'], 'notification_templates_code_locale_version_uq');
            $table->index(['code', 'locale', 'active'], 'notification_templates_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_templates');
    }
};
