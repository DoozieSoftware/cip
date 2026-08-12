<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds localization and alias support to `report_types` so the citizen
 * PWA can render localized labels and match citizen search terms
 * (P2-01). Backends on the existing `sort_order` column for common-first
 * ranking.
 *
 *  - localizations : JSON map of locale → label, e.g. {"kn-IN": "ಕಸದ ಚೂರು"}
 *  - aliases       : JSON list of alternate search terms, e.g. ["trash", "dump"]
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_types', function (Blueprint $table): void {
            $table->json('localizations')->nullable()->after('color');
            $table->json('aliases')->nullable()->after('localizations');
        });
    }

    public function down(): void
    {
        Schema::table('report_types', function (Blueprint $table): void {
            $table->dropColumn(['localizations', 'aliases']);
        });
    }
};
