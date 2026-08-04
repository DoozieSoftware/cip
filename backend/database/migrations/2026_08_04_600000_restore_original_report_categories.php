<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Restores the original broad citizen-facing issue list.
 *
 * Fine-grained department routing remains an internal concern. The PWA must
 * not expose additional categories that were not part of the original UI.
 */
return new class extends Migration
{
    public function up(): void
    {
        $activeCodes = [
            'roads',
            'water_sewage',
            'electricity',
            'garbage',
            'traffic_violation',
            'illegal_parking',
            'encroachment',
            'dead_animal',
        ];

        DB::table('report_types')
            ->whereIn('code', $activeCodes)
            ->update(['active' => true]);

        DB::table('report_types')
            ->whereNotIn('code', $activeCodes)
            ->update(['active' => false, 'sort_order' => 0]);

        DB::table('report_types')
            ->whereIn('code', $activeCodes)
            ->orderBy('code')
            ->get()
            ->each(function (object $type, int $index): void {
                DB::table('report_types')
                    ->where('id', $type->id)
                    ->update(['sort_order' => $index + 1]);
            });
    }

    public function down(): void
    {
        // The category catalog is controlled by the current seeder and is not
        // safely reversible without restoring the prior active data set.
    }
};
