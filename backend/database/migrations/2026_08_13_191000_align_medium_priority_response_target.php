<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('report_priorities')
            ->where('code', 'medium')
            ->update([
                'sla_minutes' => 48 * 60,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('report_priorities')
            ->where('code', 'medium')
            ->update([
                'sla_minutes' => 3 * 24 * 60,
                'updated_at' => now(),
            ]);
    }
};
