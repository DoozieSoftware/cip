<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Metal scrap and e-waste are collected through the Dr. Linen partner
     * service (/citizen -> "Request pickup"), which already offers Clothes &
     * Textiles, Metal Scrap and E-Waste. Leaving them in the complaint
     * taxonomy gave citizens two competing entry points for the same intent.
     *
     * This mirrors the decision already applied to `clothes_waste` in
     * 2026_08_25_000300_decouple_textile_collections_from_complaints:
     * deactivate rather than delete, so historical reports keep their
     * category and the AI classification history stays intact.
     *
     * Illegal dumping of these materials is still reportable under
     * "Garbage & Dumping", which continues to route to BBMP SWM.
     */
    private const RETIRED_CODES = ['metal_scrap', 'e_waste'];

    public function up(): void
    {
        DB::table('report_types')
            ->whereIn('code', self::RETIRED_CODES)
            ->update(['active' => false, 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('report_types')
            ->whereIn('code', self::RETIRED_CODES)
            ->update(['active' => true, 'updated_at' => now()]);
    }
};
