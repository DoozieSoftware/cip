<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->index(['current_status_id', 'submitted_at', 'id'], 'reports_status_submitted_id_index');
            $table->index(['department_id', 'submitted_at', 'id'], 'reports_department_submitted_id_index');
            $table->index(['citizen_id', 'created_at', 'id'], 'reports_citizen_created_id_index');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE reports ADD FULLTEXT INDEX reports_text_fulltext_index (title, description)');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE reports DROP INDEX reports_text_fulltext_index');
        }

        Schema::table('reports', function (Blueprint $table): void {
            $table->dropIndex('reports_status_submitted_id_index');
            $table->dropIndex('reports_department_submitted_id_index');
            $table->dropIndex('reports_citizen_created_id_index');
        });
    }
};
