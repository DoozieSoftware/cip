<?php

declare(strict_types=1);

use App\Modules\Reports\Models\ReportType;
use App\Modules\Routing\Repositories\RoutingRepository;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Adds the three citizen-facing waste-stream categories (product
 * defaults D10–D15) and routes them to BBMP Solid Waste Management:
 *
 *   9. Clothes & Textiles          (clothes_waste)
 *  10. Metal Scrap                 (metal_scrap)
 *  11. Electronic Waste (E-Waste)  (e_waste)
 *
 *  1. `report_types` — upserts the three rows (matched on `code`) with
 *     Kannada localizations and citizen search aliases. The
 *     `department_default_id` stays null: routing rules own routing.
 *  2. `routing_rules` — one `category_in` rule for all three codes,
 *     destination looked up by department code `BBMP_SWM`, medium
 *     default priority, 1440-minute SLA, evaluation order 26 (the
 *     broad-category rules end at 25).
 *  3. `prompt_versions` — bumps `category_classifier` to v7: the
 *     "Configured category codes:" line is rebuilt from the active
 *     report types (now eleven) and the three new streams are
 *     described for the vision model. The JSON response contract is
 *     unchanged; the prior approved version is deprecated.
 *
 * Production only runs `php artisan migrate --force` (never db:seed),
 * so this migration performs the domain writes itself. The same rows
 * are mirrored in ReportTypesSeeder / RoutingRulesSeeder /
 * PromptsSeeder so a fresh `migrate --seed` converges to the same
 * state. Idempotent: report types match on `code`, the routing rule
 * on `name`, and the prompt bump is skipped when version >= 7 exists.
 */
return new class extends Migration
{
    private const PROMPT_NAME = 'category_classifier';

    private const PROMPT_VERSION = 7;

    /**
     * Waste-stream block appended to the classifier prompt. Must stay
     * byte-identical to the v7 template in PromptsSeeder.
     */
    private const PROMPT_WASTE_STREAM_BLOCK = "\n\n## Waste-stream categories\n\nThree dry-waste stream categories were added for collection drives. Classify a report as one of them only when the image clearly shows that stream:\n- clothes_waste: discarded or donated clothing, fabric bundles, rags, or textiles placed out for collection.\n- metal_scrap: scrap metal such as drums, sheets, pipes, utensils, or metal debris dumped in a public space.\n- e_waste: discarded electronics such as monitors, CPUs, TVs, cables, batteries, or small appliances awaiting e-waste pickup.";

    /**
     * The phase-one marker already present in stored v6 text; the new
     * block is inserted before it so migrated and seeded v7 texts are
     * byte-identical.
     */
    private const PROMPT_PHASE1_MARKER = "\n\n## Phase 1 routing signals";

    public function up(): void
    {
        $this->upsertReportTypes();
        $this->upsertRoutingRule();
        $this->bumpClassifierPrompt();
    }

    public function down(): void
    {
        // Domain data is append-only operational configuration; the
        // seeders can restore the prior canonical set after a rollback.
    }

    private function upsertReportTypes(): void
    {
        $types = [
            [
                'name' => 'Clothes & Textiles',
                'code' => 'clothes_waste',
                'icon' => 'hanger',
                'color' => '#00897B',
                'sort_order' => 9,
                'localizations' => ['kn-IN' => 'ಬಟ್ಟೆಗಳು ಮತ್ತು ಜವಳಿ'],
                'aliases' => ['old clothes', 'clothes donation', 'textiles', 'ಬಟ್ಟೆ'],
            ],
            [
                'name' => 'Metal Scrap',
                'code' => 'metal_scrap',
                'icon' => 'scrap',
                'color' => '#607D8B',
                'sort_order' => 10,
                'localizations' => ['kn-IN' => 'ಲೋಹದ ಸ್ಕ್ರ್ಯಾಪ್'],
                'aliases' => ['scrap metal', 'loha', 'ಸ್ಕ್ರ್ಯಾಪ್'],
            ],
            [
                'name' => 'Electronic Waste (E-Waste)',
                'code' => 'e_waste',
                'icon' => 'device',
                'color' => '#C62828',
                'sort_order' => 11,
                'localizations' => ['kn-IN' => 'ಎಲೆಕ್ಟ್ರಾನಿಕ್ ತ್ಯಾಜ್ಯ (ಇ-ವೇಸ್ಟ್)'],
                'aliases' => ['e-waste', 'ewaste', 'electronics', 'computer'],
            ],
        ];

        foreach ($types as $type) {
            ReportType::query()->updateOrCreate(
                ['code' => $type['code']],
                [
                    'name' => $type['name'],
                    'description' => 'Default seeded report type for '.$type['name'].'.',
                    'icon' => $type['icon'],
                    'color' => $type['color'],
                    'localizations' => $type['localizations'],
                    'aliases' => $type['aliases'],
                    'department_default_id' => null,
                    'requires_video' => false,
                    'requires_photo' => true,
                    'min_photos' => 1,
                    'max_photos' => 5,
                    'response_target_minutes' => 2880,
                    'sort_order' => $type['sort_order'],
                    'active' => true,
                ],
            );
        }
    }

    private function upsertRoutingRule(): void
    {
        $departmentId = DB::table('departments')->where('code', 'BBMP_SWM')->value('id');
        $priorityId = DB::table('report_priorities')->where('code', 'medium')->value('id');

        if (! is_string($departmentId) || ! is_string($priorityId)) {
            // Fresh `migrate` without seed: DepartmentsSeeder /
            // ReportPrioritiesSeeder own these rows there, and
            // RoutingRulesSeeder inserts the rule during db:seed.
            return;
        }

        $attributes = [
            'conditions' => json_encode(['category_in' => ['clothes_waste', 'metal_scrap', 'e_waste']]),
            'destination_department_id' => $departmentId,
            'default_officer_id' => null,
            'default_priority_id' => $priorityId,
            'default_sla_minutes' => 1440,
            'priority' => 26,
            'description' => 'Bangalore sample routing rule.',
            'active' => true,
            'deleted_at' => null,
            'updated_at' => now(),
        ];

        $existing = DB::table('routing_rules')
            ->where('name', 'Clothes, Metal Scrap & E-Waste -> BBMP SWM')
            ->value('id');

        if ($existing === null) {
            DB::table('routing_rules')->insert(array_merge($attributes, [
                'id' => (string) Str::orderedUuid(),
                'name' => 'Clothes, Metal Scrap & E-Waste -> BBMP SWM',
                'created_at' => now(),
            ]));
        } else {
            DB::table('routing_rules')->where('id', $existing)->update($attributes);
        }

        // The engine reads active rules through a cached repository;
        // drop the cache so the new rule applies immediately.
        Cache::forget(RoutingRepository::CACHE_KEY);
    }

    private function bumpClassifierPrompt(): void
    {
        $exists = DB::table('prompt_versions')
            ->where('name', self::PROMPT_NAME)
            ->where('version', '>=', self::PROMPT_VERSION)
            ->exists();

        if ($exists) {
            return;
        }

        $base = DB::table('prompt_versions')
            ->where('name', self::PROMPT_NAME)
            ->orderByDesc('version')
            ->first();

        if ($base === null) {
            // Fresh `migrate` without seed: there is no classifier row
            // yet and PromptsSeeder creates v7 directly during db:seed.
            return;
        }

        $categoryCodes = ReportType::query()
            ->where('active', true)
            ->whereNull('deleted_at')
            ->orderBy('sort_order')
            ->orderBy('code')
            ->pluck('code')
            ->map(static fn (mixed $code): string => is_string($code) ? $code : '')
            ->filter(static fn (string $code): bool => $code !== '')
            ->values()
            ->all();

        if ($categoryCodes === []) {
            return;
        }

        $text = is_string($base->prompt_text) ? $base->prompt_text : '';

        // Replace the previously-embedded category list with the new
        // active set so the model predicts only current codes.
        $replaced = preg_replace(
            '/Configured category codes: [^.]*\./',
            'Configured category codes: '.implode(', ', $categoryCodes).'.',
            $text,
            1,
        );

        if (is_string($replaced)) {
            $text = $replaced;
        }

        // Describe the three new streams before the Phase 1 block so
        // the seeded and migrated v7 texts stay identical.
        $markerPos = strpos($text, self::PROMPT_PHASE1_MARKER);

        if ($markerPos === false) {
            $text .= self::PROMPT_WASTE_STREAM_BLOCK;
        } else {
            $text = substr($text, 0, $markerPos)
                .self::PROMPT_WASTE_STREAM_BLOCK
                .substr($text, $markerPos);
        }

        $now = now();

        DB::table('prompt_versions')->insert([
            'id' => (string) Str::uuid(),
            'name' => self::PROMPT_NAME,
            'version' => self::PROMPT_VERSION,
            'purpose' => $base->purpose,
            'provider_code' => is_string($base->provider_code) ? $base->provider_code : 'vertex-gemini-flash',
            'prompt_text' => $text,
            'expected_json_schema' => $base->expected_json_schema,
            'status' => 'approved',
            'approved_by' => null,
            'approved_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('prompt_versions')
            ->where('name', self::PROMPT_NAME)
            ->where('status', 'approved')
            ->where('version', '!=', self::PROMPT_VERSION)
            ->update(['status' => 'deprecated']);
    }
};
