<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `reports.mock_gps_score` — the citizen PWA's client-side mock-GPS
 * heuristic (`mockGpsLikely()`, 0..1), captured at submit time and
 * fed into `FraudScorer`'s `mock_gps` signal. Per docs/citizen.md
 * §"Security guardrails": the platform never auto-rejects on this
 * score alone — it is stored and surfaced to the moderator, who
 * makes the call.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->decimal('mock_gps_score', 5, 4)->nullable()->after('fraud_score');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->dropColumn('mock_gps_score');
        });
    }
};
