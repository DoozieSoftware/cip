<?php

declare(strict_types=1);

use App\Modules\Reports\Models\ReportType;
use App\Modules\Routing\Models\RoutingRule;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Restructures the citizen-facing report categories for Bengaluru
 * (BBMP) so the submit page matches how citizens actually describe
 * issues, in priority order:
 *
 *   1. Roads            (was pothole + road_damage)
 *   2. Water & Sewage   (was open_drain + water_leakage)
 *   3. Electricity      (was streetlight)
 *   4. Garbage & Dumping (was garbage + illegal_dumping)
 *   5. Traffic Violation (new)
 *   6. Illegal Parking  (kept)
 *   7. Encroachment     (kept)
 *   8. Dead Animal      (kept, last — rarer service)
 *
 * Old codes are deactivated (never deleted) so existing reports keep
 * their history; only the active set is offered to citizens and the AI.
 *
 * Also:
 *  - adds `sort_order` so the citizen API can render priority order
 *    instead of alphabetical order
 *  - rewrites the routing-rule conditions to the new codes
 *  - bumps the category_classifier prompt (v4) so the vision model
 *    only predicts the new active codes
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('report_types', 'sort_order')) {
            Schema::table('report_types', function (Blueprint $table): void {
                $table->unsignedInteger('sort_order')->default(0)->after('active');
            });
        }

        $now = now();

        $renames = [
            'garbage' => 'Garbage & Dumping',
        ];

        foreach ($renames as $code => $name) {
            ReportType::query()->where('code', $code)->update([
                'name' => $name,
                'updated_at' => $now,
            ]);
        }

        $newTypes = [
            ['name' => 'Roads', 'code' => 'roads', 'icon' => 'road', 'color' => '#3F51B5', 'sort_order' => 1],
            ['name' => 'Water & Sewage', 'code' => 'water_sewage', 'icon' => 'droplet', 'color' => '#03A9F4', 'sort_order' => 2],
            ['name' => 'Electricity', 'code' => 'electricity', 'icon' => 'bulb', 'color' => '#FFC107', 'sort_order' => 3],
            ['name' => 'Garbage & Dumping', 'code' => 'garbage', 'icon' => 'trash', 'color' => '#795548', 'sort_order' => 4],
            ['name' => 'Traffic Violation', 'code' => 'traffic_violation', 'icon' => 'traffic', 'color' => '#D32F2F', 'sort_order' => 5],
            ['name' => 'Illegal Parking', 'code' => 'illegal_parking', 'icon' => 'parking', 'color' => '#FF5722', 'sort_order' => 6],
            ['name' => 'Encroachment', 'code' => 'encroachment', 'icon' => 'fence', 'color' => '#6A1B9A', 'sort_order' => 7],
            ['name' => 'Dead Animal', 'code' => 'dead_animal', 'icon' => 'alert', 'color' => '#212121', 'sort_order' => 8],
        ];

        foreach ($newTypes as $type) {
            ReportType::query()->updateOrCreate(
                ['code' => $type['code']],
                array_merge($type, [
                    'description' => 'Default seeded report type for '.$type['name'].'.',
                    'requires_video' => false,
                    'requires_photo' => true,
                    'min_photos' => 1,
                    'max_photos' => 5,
                    'active' => true,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]),
            );
        }

        $deprecatedCodes = [
            'pothole', 'road_damage', 'water_leakage', 'streetlight',
            'open_drain', 'illegal_dumping',
        ];

        ReportType::query()
            ->whereIn('code', $deprecatedCodes)
            ->update([
                'active' => false,
                'sort_order' => 0,
                'updated_at' => $now,
            ]);

        $this->updateRoutingRules();
        $this->bumpClassifierPrompt();
    }

    public function down(): void
    {
        Schema::table('report_types', function (Blueprint $table): void {
            $table->dropColumn('sort_order');
        });
    }

    private function updateRoutingRules(): void
    {
        $bbmp = DB::table('departments')->where('code', 'BBMP_WARD_112')->value('id');
        $btp = DB::table('departments')->where('code', 'BTP_TRAFFIC')->value('id');

        if ($bbmp === null || $btp === null) {
            return;
        }

        $rules = [
            [
                'name' => 'Garbage -> BBMP Ward 112',
                'conditions' => ['category_in' => ['garbage']],
                'department' => $bbmp,
            ],
            [
                'name' => 'Roads, Water & Electricity -> BBMP Ward 112',
                'conditions' => ['category_in' => ['roads', 'water_sewage', 'electricity']],
                'department' => $bbmp,
            ],
            [
                'name' => 'Traffic & Parking -> BTP',
                'conditions' => ['category_in' => ['traffic_violation', 'illegal_parking', 'encroachment']],
                'department' => $btp,
            ],
            [
                'name' => 'Dead Animal -> BBMP Ward 112',
                'conditions' => ['category_in' => ['dead_animal']],
                'department' => $bbmp,
            ],
        ];

        $now = now();

        $mediumPriority = DB::table('report_priorities')->where('code', 'medium')->value('id');
        $highPriority = DB::table('report_priorities')->where('code', 'high')->value('id');

        foreach ($rules as $rule) {
            RoutingRule::query()->updateOrCreate(
                ['name' => $rule['name']],
                [
                    'conditions' => $rule['conditions'],
                    'destination_department_id' => $rule['department'],
                    'default_priority_id' => $rule['department'] === $btp ? $highPriority : $mediumPriority,
                    'default_officer_id' => null,
                    'priority' => 10,
                    'description' => 'Bengaluru routing rule.',
                    'active' => true,
                    'updated_at' => $now,
                ],
            );
        }

        // Deactivate the two legacy rules whose conditions now reference
        // codes that no longer exist in the active set.
        foreach (['Pothole -> BBMP Ward 112', 'Illegal Parking -> BTP'] as $legacyName) {
            DB::table('routing_rules')
                ->where('name', $legacyName)
                ->update(['active' => false, 'updated_at' => $now]);
        }
    }

    private function bumpClassifierPrompt(): void
    {
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

        $existing = DB::table('prompt_versions')
            ->where('name', 'category_classifier')
            ->where('version', 4)
            ->first();

        if ($existing !== null) {
            return;
        }

        $base = DB::table('prompt_versions')
            ->where('name', 'category_classifier')
            ->where('version', 3)
            ->first();

        if ($base === null) {
            return;
        }

        $baseText = $base->prompt_text;
        $text = is_string($baseText) ? $baseText : '';

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

        // Refresh the prose examples that referenced merged category codes.
        $text = str_replace(
            'Match ONLY the PRIMARY civic issue type (e.g., pothole, garbage, broken streetlight)',
            'Match ONLY the PRIMARY civic issue type (e.g., roads, garbage, electricity)',
            $text,
        );
        $text = str_replace(
            'citizen claims pothole but image shows garbage, dead animal, or a streetlight',
            'citizen claims roads but image shows garbage, dead animal, or electricity',
            $text,
        );
        $text = str_replace(
            'Example: citizen claims pothole but image shows garbage',
            'Example: citizen claims roads but image shows garbage',
            $text,
        );

        $now = now();

        DB::table('prompt_versions')->insert([
            'id' => (string) Str::uuid(),
            'name' => 'category_classifier',
            'version' => 4,
            'purpose' => $base->purpose,
            'provider_code' => 'vertex-gemini-flash',
            'prompt_text' => $text,
            'expected_json_schema' => $base->expected_json_schema,
            'status' => 'approved',
            'approved_by' => null,
            'approved_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('prompt_versions')
            ->where('name', 'category_classifier')
            ->where('status', 'approved')
            ->where('version', '!=', 4)
            ->update(['status' => 'deprecated']);
    }
};
