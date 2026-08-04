<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Phase 1 AI prompt update (docs/department-routing-implementation-plan.md §3.5).
 *
 * Extends the category_classifier JSON schema with two Phase 1 fields:
 *  - `emergency_flag`  (bool)   — true when the image/text signals an
 *    immediate life-safety risk (fire, collapse, live wire, flooding,
 *    trapped person, severe crash). The AiCompletedListener surfaces
 *    this to the moderator without auto-dispatching (that is Phase 2,
 *    blocked on governance policy O4).
 *  - `secondary_triggers` (string[]) — trigger codes like
 *    `traffic_obstruction`, `road_damage_by_utility_work` and
 *    `sewage_in_drain` so Track B's SecondaryRoutingService knows which
 *    additional department should receive a linked task.
 *
 * The prompt text is appended with a short instruction block; the
 * 15-code category list was already updated by the taxonomy migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        $base = DB::table('prompt_versions')
            ->where('name', 'category_classifier')
            ->orderByDesc('version')
            ->first();

        if ($base === null) {
            return;
        }

        $baseVersion = $base->version;
        $nextVersion = is_numeric($baseVersion) ? ((int) $baseVersion) + 1 : 1;

        $exists = DB::table('prompt_versions')
            ->where('name', 'category_classifier')
            ->where('version', $nextVersion)
            ->exists();

        if ($exists) {
            return;
        }

        // Extend the JSON schema with the two new fields.
        $decodedSchema = is_string($base->expected_json_schema)
            ? json_decode($base->expected_json_schema, true)
            : null;
        $schema = is_array($decodedSchema) ? $decodedSchema : [];

        $properties = $schema['properties'] ?? [];
        $properties = is_array($properties) ? $properties : [];
        $properties['emergency_flag'] = [
            'type' => 'boolean',
            'description' => 'True when the image/text signals an immediate life-safety risk. Set false for routine issues.',
        ];
        $properties['secondary_triggers'] = [
            'type' => 'array',
            'items' => ['type' => 'string'],
            'description' => 'Zero or more trigger codes: traffic_obstruction, road_damage_by_utility_work, sewage_in_drain, cable_hazard, footpath_damage_by_parking. Leave empty when none apply.',
        ];
        $schema['properties'] = $properties;

        $required = $schema['required'] ?? [];
        $required = is_array($required) ? $required : [];
        $required = array_values(array_filter(
            $required,
            static fn (mixed $value): bool => is_string($value),
        ));
        $required[] = 'emergency_flag';
        $required[] = 'secondary_triggers';
        $schema['required'] = array_values(array_unique($required));

        // Append instructions to the prompt text.
        $text = is_string($base->prompt_text) ? $base->prompt_text : '';

        $append = "\n\n## Phase 1 routing signals\n\nReturn two additional fields alongside the category:\n\n1. `emergency_flag` (bool): Set true ONLY when the image or text signals an immediate life-safety risk (fire, collapse, live wire, trapped person, severe flooding, major crash). Set false for all routine issues.\n\n2. `secondary_triggers` (array of strings): Include a trigger code when a second agency is also needed. Valid codes:\n   - traffic_obstruction — the issue is causing or will cause traffic disruption\n   - road_damage_by_utility_work — the road damage is caused by utility excavation (water/power)\n   - sewage_in_drain — sewage is flowing into a storm water drain\n   - cable_hazard — dangling cables creating a safety risk\n   - footpath_damage_by_parking — illegal parking is damaging a footpath\n\nLeave `secondary_triggers` as `[]` when no co-routing is needed.";

        $text .= $append;

        $now = now();

        DB::table('prompt_versions')->insert([
            'id' => (string) Str::uuid(),
            'name' => 'category_classifier',
            'version' => $nextVersion,
            'purpose' => $base->purpose,
            'provider_code' => $base->provider_code,
            'prompt_text' => $text,
            'expected_json_schema' => json_encode($schema),
            'status' => 'approved',
            'approved_by' => null,
            'approved_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('prompt_versions')
            ->where('name', 'category_classifier')
            ->where('status', 'approved')
            ->where('version', '!=', $nextVersion)
            ->update(['status' => 'deprecated']);
    }

    public function down(): void
    {
        // The prompt version is append-only; down() is no-op because
        // reverting the schema/prompt text would break auditability.
    }
};
