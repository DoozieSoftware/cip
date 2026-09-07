<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('textile_capacity_rules')
            ->whereNull('deleted_at')
            ->update([
                'min_bags' => 2,
                'min_weight_kg' => 4,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Previous partner-specific values cannot be reconstructed safely.
    }
};
