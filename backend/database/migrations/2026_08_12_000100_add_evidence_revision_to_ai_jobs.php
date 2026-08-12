<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_jobs', function (Blueprint $table): void {
            $table->string('evidence_revision', 64)->nullable()->after('report_id');
            $table->index(['report_id', 'evidence_revision']);
        });
    }

    public function down(): void
    {
        Schema::table('ai_jobs', function (Blueprint $table): void {
            $table->dropIndex(['report_id', 'evidence_revision']);
            $table->dropColumn('evidence_revision');
        });
    }
};
