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
                'guidance_text' => 'Home pickup requires at least 2 bags or 4 kg. Drop-off accepts any amount.',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Previous partner-specific guidance cannot be reconstructed safely.
    }
};
