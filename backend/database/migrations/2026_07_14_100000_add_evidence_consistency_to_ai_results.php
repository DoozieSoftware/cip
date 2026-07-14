<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_results', function (Blueprint $table): void {
            $table->boolean('claim_matches_evidence')->nullable()->after('summary');
            $table->unsignedTinyInteger('consistency_score')->nullable()->after('claim_matches_evidence');
            $table->text('mismatch_reason')->nullable()->after('consistency_score');
            $table->decimal('synthetic_score', 5, 4)->nullable()->after('mismatch_reason');
        });
    }

    public function down(): void
    {
        Schema::table('ai_results', function (Blueprint $table): void {
            $table->dropColumn([
                'claim_matches_evidence',
                'consistency_score',
                'mismatch_reason',
                'synthetic_score',
            ]);
        });
    }
};
