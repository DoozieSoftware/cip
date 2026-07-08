<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Fix reports.ai_confidence / fraud_score / duplicate_score precision.
 *
 * They were created as decimal(5,4) (max 9.9999), but AiPipelineOrchestrator
 * writes percentages on the 0..100 scale. Values >= 10 overflowed and caused
 * every successful AI classification to fail on ->save(), so scores never
 * persisted and the Duplicates/Fraud queues stayed empty.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE reports MODIFY ai_confidence DECIMAL(5,2) NULL');
        DB::statement('ALTER TABLE reports MODIFY fraud_score DECIMAL(5,2) NULL');
        DB::statement('ALTER TABLE reports MODIFY duplicate_score DECIMAL(5,2) NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE reports MODIFY ai_confidence DECIMAL(5,4) NULL');
        DB::statement('ALTER TABLE reports MODIFY fraud_score DECIMAL(5,4) NULL');
        DB::statement('ALTER TABLE reports MODIFY duplicate_score DECIMAL(5,4) NULL');
    }
};
